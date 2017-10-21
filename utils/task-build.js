const fs = require('fs');
const exec = require('child_process').exec;
const child_proc = require('child_process');
const path = require('path');
const svnUltimate = require('node-svn-ultimate');
const tarPack = require('tar-pack');
const Client = require('ssh2-sftp-client');
const logger = require('log4js').getLogger();
const { wrap: async } = require('co');
const Jenkins = require('jenkins');
const mongoose = require('mongoose');
const taskModel = mongoose.model('taskModel');
const taskBuildLogModel = mongoose.model('taskBuildLogModel');
const msg = require('./message');
const util = require('./util');
const systemConfig = util.getSystemConfig();
const systemParam = util.getSystemParam();
const _ = require('./fis-util');


module.exports = TaskBuild = {
    //打包队列Map
    packQueueMap: {},
    //合包队列Map
    combineQueueMap: {},
    //发包队列Map
    publishQueueMap: {},
    //合包定时器
    combineTimer: {},
    //发包定时器
    publishTimer:{},
    //添加打包队列元素
    addPackQueueItem: function(req, res) {
        const taskId = req.body.taskId;

        if (!TaskBuild.packQueueMap[taskId]) {
            TaskBuild.packQueueMap[taskId] = [];
        }
        TaskBuild.packQueueMap[taskId].push({ req: req, res: res });
        if (TaskBuild.packQueueMap[taskId].length === 1) {
            TaskBuild.packApp(req, res);
        }
    },
    //打包逻辑处理
	packApp:async(function*(req, res) {
        const taskId = req.body.taskId; //任务id
        const projectName = req.body.projectName; //项目名字
        const tagVersion = req.body.tagVersion; //tag版本
        const backEndVersion = req.body.backEndVersion; //后端版本号
        const task = yield taskModel.getTaskById(taskId); //task对象
        const ftp = task.ftp; //ftp对象
        const app = task.app; //app对象
        req.body.appId = app._id;
        const isCombine = task.isCombinePackage; //是否合包
        const isPublish = task.isPublish; //是否发包
        const BUILD_PROJECT_ROOT_DIR = systemConfig.buildProjectRootDir; //基础根目录
        const TEMP_STATIC_DIR_NAME = systemConfig.tempStaticDirName; //静态目录名
        const TEMP_APP_DIR_NAME = systemConfig.tempAppDirName; //应用目录名
        const TEMP_APP_SOURCE_DIR_NAME = systemConfig.tempAppSourceDirName; //应用源码目录名
        const isPackageAll = (projectName === 'all project'); //是否打全量
        const TASK_DIR_PATH = `${BUILD_PROJECT_ROOT_DIR}/${task.name}`; //任务目录
        const TASK_DIR_SOURCE_PATH = `${TASK_DIR_PATH}/${TEMP_APP_SOURCE_DIR_NAME}`; //任务下源码目录
        const TEMP_STATIC_PATH = `${TASK_DIR_PATH}/${TEMP_STATIC_DIR_NAME}`; //静态目录
        const TEMP_APP_PATH = `${TASK_DIR_PATH}/${TEMP_APP_DIR_NAME}`; //应用目录
        const taskBranchType = task.branchType;//任务的分支类型
        const isTag = (taskBranchType === 'tag'); //是否打tag包
        const buildCommand = task.command; //输出build时的命令行
        
        try{
            //删除构建目录下内容
            delFolder(`${TASK_DIR_PATH}/${TEMP_APP_SOURCE_DIR_NAME}`);//删除源source目录
            delFolder(`${TASK_DIR_PATH}/${TEMP_APP_SOURCE_DIR_NAME}.tar.gz`);//删除应用app.tar.gz文件
            delFolder(`${TASK_DIR_PATH}/${TEMP_APP_SOURCE_DIR_NAME}.tar.gz`);//删除静态static.tar.gz文件
            //创建任务目录
            _.mkdir(TASK_DIR_SOURCE_PATH);
            //获取应用的SVN路径
            const appSvnPath = getAppSvnPath(app,taskBranchType);
            //全量包，checkout应用目录
            if(isPackageAll){
                //获取所有的项目名称,[],遍历[]找最大的版本
                let allProject = [];
                let svnChildDirList = yield getSvnChildDirList(appSvnPath);
                svnChildDirList.forEach(function(item){
                    allProject.push(item.name);
                });                
                for (let item of allProject) {
                    let versionList = [];
                    let svnTagChildDirList = yield getSvnChildDirList(`${appSvnPath}/${item}`);
                    svnTagChildDirList.forEach(function(item){
                        versionList.push(item.name);
                    });
                    let version = util.sortByVersionNumber(versionList,null,true);
                    version = version.length>0 ? version[0] : '';
                    yield checkoutSvnProject(`${appSvnPath}/${item}/${version}`,`${TASK_DIR_SOURCE_PATH}/${item}`);
                }
               
            }
            //非全量包，checkout项目目录
            else{
                //checkout项目目录
                yield checkoutSvnProject(`${appSvnPath}/${projectName}`,`${TASK_DIR_SOURCE_PATH}/${projectName}`);
            }

            //遍历任务目录中各项目，提取build中内容存放至static或app目录中
            let projectsDefault = fs.readdirSync(TASK_DIR_SOURCE_PATH);
            //过滤.svn文件夹
            let projects = projectsDefault.filter(function(item){
                let appPath = `${TASK_DIR_SOURCE_PATH}/${item}`;
                return (item!=='.svn' && _.isDir(appPath) && fs.existsSync(`${appPath}/config.json`));
            });
            
            let execParams = {
                buildCommand:buildCommand,
                projects:projects,
                TASK_DIR_SOURCE_PATH:TASK_DIR_SOURCE_PATH,
                TEMP_STATIC_PATH:TEMP_STATIC_PATH,
                TEMP_APP_PATH:TEMP_APP_PATH,
                app:app
            }
            //执行命令(gfe o -all)并拷贝文件
            yield execCommand(execParams);
            //获取app的SvnRevision;
            let svnInfo = null;
            if(isPackageAll){
                svnInfo = yield getSvnInfo(`${appSvnPath}`);
            }else{
                svnInfo = yield getSvnInfo(`${appSvnPath}/${projectName}`);
            }
            let revision = svnInfo.entry.$.revision;//提交svn生成的随机号569655
            /*E:/myBuild/gfe/feapp/[UAT]channel-web/static/image 
            E:/myBuild/gfe/feapp/[UAT]channel-web/static.tar.gz 
            E:/myBuild/gfe/feapp/[UAT]channel-web/app/channel-web 
            E:/myBuild/gfe/feapp/[UAT]channel-web/app.tar.gz*/
            //生成压缩包tar.gz文件
            const originStaticPackPath = getSubDirPath(TEMP_STATIC_PATH);
            const targetStaticPackPath = `${TEMP_STATIC_PATH}.tar.gz`;
            const originAppPackPath = getSubDirPath(TEMP_APP_PATH);
            const targetAppPackPath = `${TEMP_APP_PATH}.tar.gz`;

            yield packDirectory(originStaticPackPath,targetStaticPackPath,TEMP_STATIC_DIR_NAME);
            yield packDirectory(originAppPackPath,targetAppPackPath,TEMP_APP_DIR_NAME);

            
            //上传ftp
            //yield uploadFtp(ftp,revision,targetStaticPackPath,targetAppPackPath,app);
            let mapUrl = systemConfig.mapUrl;
            let mapUrlNew = function(){
                if((task.name).indexOf('UAT')!=-1){
                    return mapUrl+'/uat/'+app.name;
                }
                if((task.name).indexOf('PRD')!=-1){
                    return mapUrl+'/prd/'+app.name;
                }
            }();

            console.log('11111111111111111111111');
            console.log(targetStaticPackPath);
            console.log(targetAppPackPath);
            console.log(mapUrlNew);
            console.log(`${mapUrlNew}/${app.name}_image_${revision}.tar.gz`);
            console.log(`${mapUrlNew}/${app.name}_${revision}.tar.gz`);
            console.log('11111111111111111111111');

            if(fs.existsSync(targetStaticPackPath)){
                _.copy(targetStaticPackPath,`${mapUrlNew}/${app.name}_image_${revision}.tar.gz`);
            }
            if(fs.existsSync(targetAppPackPath)){
                _.copy(targetAppPackPath,`${mapUrlNew}/${app.name}_${revision}.tar.gz`);
            }

            TaskBuild.packQueueMap[taskId].shift();//移除打包完的任务
            //如果队列中还有其它任务，则继续打包
            if(TaskBuild.packQueueMap[taskId].length > 0){
                const frontQueueItem = TaskBuild.packQueueMap[taskId][0];
                TaskBuild.packApp(frontQueueItem.req,frontQueueItem.res);   
            }
            let packAppStr = '前端打包完成，版本号：'+ revision;
            let buildStatus = systemParam.buildStatus.constant.STEP1SUCCESS;
            
            let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,packAppStr,'package');
            let taskBuildLogId = taskBuildLog._id;
            
            res.send({params:req.body,revision:revision,isCombine:isCombine,isPublish:isPublish,id:taskBuildLogId,info:msg.genSuccessMsg(packAppStr)});
        }catch(error){
            logger.error(req.url, '打包失败', error);
            TaskBuild.packQueueMap[taskId].shift();//移除打包完的任务
            if(TaskBuild.packQueueMap[taskId].length > 0){
                const frontQueueItem = TaskBuild.packQueueMap[taskId][0];
                TaskBuild.packApp(frontQueueItem.req,frontQueueItem.res);   
            }

            //获取应用的SVN路径
            const appSvnPath = getAppSvnPath(app,taskBranchType);

            let svnInfo = null;
            if(isPackageAll){
                svnInfo = yield getSvnInfo(`${appSvnPath}`);
            }else{
                svnInfo = yield getSvnInfo(`${appSvnPath}/${projectName}`);
            }
            let revision = svnInfo.entry.$.revision;

            let buildStatus = systemParam.buildStatus.constant.STEP1FAILED;
            let packAppStr = '前端打包失败，版本号：'+revision;
            let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,packAppStr,'package');
            res.send({isCombine:isCombine,isPublish:isPublish,info:msg.genFailedMsg('打包失败')});
        }
	}),
    //添加合包队列元素
    // addCombineQueueItem: function(req, res, revision) {
    addCombineQueueItem: async(function*(req, res) {
        const taskId = req.body.taskId; //任务id
        const projectName = req.body.projectName; //项目名字
        const isPackageAll = (projectName === 'all project');
        const task = yield taskModel.getTaskById(taskId); //task对象
        const app = task.app; //app对象
        req.body.appId = app._id;

        //获取app的SvnRevision;
        const taskBranchType = task.branchType;//任务的分支类型
        const appSvnPath = getAppSvnPath(app,taskBranchType);
        
        let revision = req.body.revision;
        
        const combineName = systemConfig.combineJenkinsName;
        if(!TaskBuild.combineQueueMap[combineName]){
            TaskBuild.combineQueueMap[combineName] = [];
        }
        TaskBuild.combineQueueMap[combineName].push({ req: req, res: res,revision:revision,task:task });
        if (TaskBuild.combineQueueMap[combineName].length === 1) {
            TaskBuild.combinePackager(req, res, revision,task);
        }
    }),
    //合包逻辑处理
    combinePackager: async(function*(req, res, revision,task) {
        try{
            const backEndVersion = req.body.backEndVersion; //后端版本号
            const app = task.app; //app对象
            const ftp = task.ftp;  //ftp对象
            //连接jenkins
            const jenkins = Jenkins(`http:\/\/${systemConfig.combineJenkinsUserName}:${systemConfig.combineJenkinsPassword}@${systemConfig.combineJenkinsPath}`);
            //获取jenkins的job名
            const jenkinsName = systemConfig.combineJenkinsName;
            //获取任务中jenkins的传参项,初始化合包jenkins对象
            let combineJenkins = {};
            combineJenkins.name = jenkinsName;
            combineJenkins.parameters = {};
            combineJenkins.parameters.SVNPATH = task.backEndPackagePath;
            combineJenkins.parameters.VERSION = backEndVersion;
            combineJenkins.parameters.REVERSION = revision;
            combineJenkins.parameters.FTPPATH = ftp.path;
            combineJenkins.parameters.APPNAME = app.name;
            
            //调用jenkins合包
            yield jenkinsJobBuild(jenkins,combineJenkins);
            //拿到jenkins的job序号
            const jobObj = yield jenkinsJobGet(jenkins,jenkinsName);
            const jobNumber = jobObj.nextBuildNumber;

            TaskBuild.combineTimer[jenkinsName] = setTimeout(function(){
                TaskBuild.combineJenkinsSchedule(req,res,jenkins,jenkinsName,jobNumber,task,revision);
            },3000);
        }catch(error){
            logger.error(req.url, '合包失败', error);
            res.send({info:msg.genFailedMsg('合包失败')});
        }
    }),
    combineJenkinsSchedule: async(function*(req, res,jenkins,jenkinsName,jobNumber,task,revision) {
        //调用jenkins的log方法
        const isPublish = task.isPublish; //是否发包
        try{
            const backEndVersion = req.body.backEndVersion; //后端版本号
            yield jenkinsBuildLog(jenkins,jenkinsName,jobNumber);
            const jenkinsBuildingData = yield jenkinsJobGet(jenkins,jenkinsName);
            
            var color = jenkinsBuildingData.color;
            if (color === 'blue' || color === 'red' || color==='aborted'){
                if (TaskBuild.combineTimer[jenkinsName]) {
                    clearTimeout(TaskBuild.combineTimer[jenkinsName]);
                }
                
                TaskBuild.combineQueueMap[jenkinsName].shift();//移除合包完的任务
                //如果队列中还有其它任务，则继续合包
                if(TaskBuild.combineQueueMap[jenkinsName].length > 0){
                    const frontQueueItem = TaskBuild.combineQueueMap[jenkinsName][0];
                    TaskBuild.combinePackager(frontQueueItem.req,frontQueueItem.res,frontQueueItem.revision,frontQueueItem.task);   
                }
                // let url = 'http://'+task.jenkinsPath+'/job/'+systemConfig.combineJenkinsName+'/'+jobNumber+'/console';
                let url = 'http://'+systemConfig.combineJenkinsPath+'/job/'+systemConfig.combineJenkinsName+'/'+jobNumber+'/console';
                if(color=='red'){
                    let buildStatus = systemParam.buildStatus.constant.STEP2FAILED;
                    let combinePacStr = '合包任务失败，版本号：'+backEndVersion+'.'+revision;
                    let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,combinePacStr);
                    res.send({params:req.body,isPublish:isPublish,revision:revision,id:req.body.id,info:msg.genFailedMsg(resMsg(combinePacStr,url))});
                }
                if(color=='aborted'){
                    let buildStatus = systemParam.buildStatus.constant.STEP2FAILED;
                    let combinePacStr = '合包任务被终止，版本号：'+backEndVersion+'.'+revision;
                    let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,combinePacStr);
                    res.send({params:req.body,isPublish:isPublish,revision:revision,id:req.body.id,info:msg.genFailedMsg(resMsg(combinePacStr,url))});
                }
                if(color=='blue'){
                    let combinePacStr = '后端合包完成，版本号：'+backEndVersion+'.'+revision;
                    let buildStatus = systemParam.buildStatus.constant.STEP2SUCCESS;
                    let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,resMsg(combinePacStr,url),'combine');
                    res.send({params:req.body,isPublish:isPublish,revision:revision,id:req.body.id,info:msg.genSuccessMsg(resMsg(combinePacStr,url))});
                }
                
            }else{
                combineTimer(req,res,jenkins,jenkinsName,jobNumber,task,revision);
            }
        }catch(err){
            combineTimer(req,res,jenkins,jenkinsName,jobNumber,task,revision);
        } 
    }),

    //添加发包队列元素
    addPublishQueueItem: async(function*(req, res) {
        const taskId = req.body.taskId; //任务id
        const projectName = req.body.projectName; //项目名字
        const isPackageAll = (projectName === 'all project');
        const task = yield taskModel.getTaskById(taskId); //task对象
        const app = task.app; //app对象
        req.body.appId = app._id;

        //获取app的SvnRevision;
        const taskBranchType = task.branchType;//任务的分支类型
        const appSvnPath = getAppSvnPath(app,taskBranchType);

        let revision = req.body.revision;
        
        const jenkinsName = task.jenkinsName;
        if(!TaskBuild.publishQueueMap[jenkinsName]){
            TaskBuild.publishQueueMap[jenkinsName] = [];
        }
        TaskBuild.publishQueueMap[jenkinsName].push({ req: req, res: res,revision:revision,task:task });
        if (TaskBuild.publishQueueMap[jenkinsName].length === 1) {
            TaskBuild.publishPackager(req, res,revision,task );
        }
    }),
    //发包逻辑处理
    publishPackager: async(function*(req, res, revision, task) {
        try{
            const app = task.app;
            //连接jenkins
            const jenkins = Jenkins(`http:\/\/${task.jenkinsUsername}:${task.jenkinsPassword}@${task.jenkinsPath}`);
            //获取jenkins的job名
            const jenkinsName = task.jenkinsName;
            const backEndVersion = req.body.backEndVersion; //后端版本号
            //获取任务中jenkins的传参项,初始化合包jenkins对象
            let publishJenkins = {};
            publishJenkins.name = jenkinsName;
            publishJenkins.parameters = {};
            // publishJenkins.parameters.NUM = backEndVersion+'.'+revision; //五位版本号
            // publishJenkins.parameters.SERVER = app.name; //服务器名
            //svn版本号或五位版本号(后端四位+前端一位)
            if(publishJenkins.parameters[task.jobFirstParamKey]!==''){
                if(backEndVersion!==''){
                    publishJenkins.parameters[task.jobFirstParamKey] = backEndVersion+'.'+revision;
                }else{
                    publishJenkins.parameters[task.jobFirstParamKey] = revision;
                }
            }
            if(publishJenkins.parameters[task.jobSecondParamKey]!==''){
                publishJenkins.parameters[task.jobSecondParamKey] = task.jobSecondParamValue;
            }
            if(publishJenkins.parameters[task.jobThirdParamKey]!==''){
                publishJenkins.parameters[task.jobThirdParamKey] = task.jobThirdParamValue;
            }
            // publishJenkins.parameters.NUM = '1.0.173.3.517163';
            // publishJenkins.parameters.SERVER = 'channel-web';
            //调用jenkins发包
            yield jenkinsJobBuild(jenkins,publishJenkins);
            //拿到jenkins的job序号
            const jobObj = yield jenkinsJobGet(jenkins,jenkinsName);
            const jobNumber = jobObj.nextBuildNumber;
            TaskBuild.publishTimer[jenkinsName] = setTimeout(function(){
                TaskBuild.publishJenkinsSchedule(req,res,jenkins,jenkinsName,jobNumber);
            },3000);
        }catch(error){
            logger.error(req.url, '发包失败', error);
            res.send({info:msg.genFailedMsg('发包失败')});
        }
    }),
    publishJenkinsSchedule:async(function*(req, res,jenkins,jenkinsName,jobNumber) {
        const taskId = req.body.taskId; //任务id
        const task = yield taskModel.getTaskById(taskId); //task对象
        //调用jenkins的log方法
        try{
            yield jenkinsBuildLog(jenkins,jenkinsName,jobNumber);
            const jenkinsBuildingData = yield jenkinsJobGet(jenkins,jenkinsName);
            var color = jenkinsBuildingData.color;
            if (color === 'blue' || color === 'red' || color==='aborted'){
                let url = `http:\/\/${task.jenkinsPath}/job/${jenkinsName}/${jobNumber}/console`;
                if (TaskBuild.publishTimer[jenkinsName]) {
                    clearTimeout(TaskBuild.publishTimer[jenkinsName]);
                }
                TaskBuild.publishQueueMap[jenkinsName].shift();//移除发包完的任务
                //如果队列中还有其它任务，则继续发包
                if(TaskBuild.publishQueueMap[jenkinsName].length > 0){
                    const frontQueueItem = TaskBuild.publishQueueMap[jenkinsName][0];
                    TaskBuild.publishPackager(frontQueueItem.req,frontQueueItem.res,frontQueueItem.revision,frontQueueItem.task);   
                }
                if(color=='blue'){
                    let buildStatus = systemParam.buildStatus.constant.STEP3SUCCESS;
                    let publishStr = resMsg('发版完成！',url);
                    let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,publishStr,'publish');
                    res.send({params:req.body,info:msg.genSuccessMsg(resMsg('发版完成！',url))});
                }
                
                if(color=='red'){
                    let buildStatus = systemParam.buildStatus.constant.STEP3FAILED;
                    let publishStr = resMsg('发版失败！',url);
                    let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,publishStr,'publish');
                    res.send({params:req.body,info:msg.genFailedMsg(resMsg('发版失败！',url))});
                }
                if(color=='aborted'){
                    let buildStatus = systemParam.buildStatus.constant.STEP3FAILED;
                    let publishStr = resMsg('发包任务被终止！',url);
                    let taskBuildLog = yield TaskBuild.putBuildLogInDB(req,buildStatus,publishStr,'publish');
                    res.send({params:req.body,info:msg.genFailedMsg(resMsg('发包任务被终止！',url))});
                }
            }else{
                publishTimer(req,res,jenkins,jenkinsName,jobNumber);
            }
        }catch(err){
            publishTimer(req,res,jenkins,jenkinsName,jobNumber);
        }
    }),
    putBuildLogInDB:async(function*(req,buildStatus,errText,type){

        try{
            req.body.createdBy = req.session.user.username;
            req.body.buildStatus = buildStatus;
            req.body.task = req.body.taskId;
            req.body.app = req.body.appId;
            let taskBuildLog =null;
            if(req.body.id!=undefined && req.body.id!=''){ //更新操作: combine或publish时会传req.body.id,更新库里数据
                taskBuildLog = yield taskBuildLogModel.getTaskBuildLogById(req.body.id);
                taskBuildLog.buildStatus = buildStatus;
                if(type==='combine'){
                    taskBuildLog.combineResult = errText;
                    taskBuildLog.publishResult = '';
                }
                if(type==='publish'){
                    taskBuildLog.publishResult = errText;
                }
            }else{ //写入操作: 第一步package打包时入库
                if(type==='package'){
                    req.body.packageResult = errText;
                    req.body.combineResult = '';
                    req.body.publishResult = '';
                }
                taskBuildLog = new taskBuildLogModel(req.body);
            }
            let taskBuildLogId = taskBuildLog._id;
            yield taskBuildLog.updateAndSave();
            console.info('任务构建日志保存成功');
            return taskBuildLog;
        } catch(error){
            logger.error(req.url, '任务构建日志保存失败', error);
            console.info('任务构建日志保存失败');
        }
    })
};
/**
 * [生成描述信息]
 * @param  {String} msg 描述信息
 * @param  {String} url url地址
 * @return {String} msgStr  最终返回的字符串
 */
function resMsg(msg,url){
    let msgStr = msg+'（<a style="color:#20a0ff" target="_blank" href="'+url+'">show log</a>）';
    return msgStr;
}
/**
 * 循环调用jenkins的job,判断color状态
 * @param  {Object} req         request对象
 * @param  {Object} res         response对象
 * @param  {Object} jenkins     jenkins对象
 * @param  {String} jenkinsName jenkins的job名
 * @param  {Number} jobNumber   jenkins的job的number
 */
function publishTimer(req,res,jenkins,jenkinsName,jobNumber){
    if (TaskBuild.publishTimer[jenkinsName]) {
        clearTimeout(TaskBuild.publishTimer[jenkinsName]);
    }
    TaskBuild.publishTimer[jenkinsName] = setTimeout(function(){
        TaskBuild.publishJenkinsSchedule(req,res,jenkins,jenkinsName,jobNumber);
    },3000);
}

/**
 * 循环调用jenkins的job,判断color状态
 * @param  {Object} req         request对象
 * @param  {Object} res         response对象
 * @param  {Object} jenkins     jenkins对象
 * @param  {String} jenkinsName jenkins的job名
 * @param  {Number} jobNumber   jenkins的job的number
 */
function combineTimer(req,res,jenkins,jenkinsName,jobNumber,task,revision){
    if (TaskBuild.combineTimer[jenkinsName]) {
        clearTimeout(TaskBuild.combineTimer[jenkinsName]);
    }
    TaskBuild.combineTimer[jenkinsName] = setTimeout(function(){
        TaskBuild.combineJenkinsSchedule(req,res,jenkins,jenkinsName,jobNumber,task,revision);
    },3000);
}

/**
 * jenkins的get
 * @param  {Object} jenkins     jenkins对角
 * @param  {Object} jenkinsObj  jenkins的合包参数对象
 */
function jenkinsJobBuild(jenkins,jenkinsObj){
    return new Promise(function(resolve,reject){
        jenkins.job.build(jenkinsObj,function(err) {
            if (err) {
                reject(err);
            }else{
                resolve();
            }
        });
    });
}
/**
 * jenkins的get
 * @param  {Object} jenkins     jenkins对角
 * @param  {String} jobName     jenkins的job名
 */
function jenkinsJobGet(jenkins,jobName){
    return new Promise(function(resolve,reject){
        jenkins.job.get(jobName, function(err, data) {
            if (err) {
                reject(err);
            }else{
                resolve(data);
            }
        });
    });
}
/**
 * jenkins的log
 * @param  {Object} jenkins     jenkins对角
 * @param  {String} jobName     jenkins的job名
 * @param  {Number} jobNumber   jenkins的job的number
 */
function jenkinsBuildLog(jenkins,jobName,jobNumber){
    return new Promise(function(resolve,reject){
        jenkins.build.log(jobName, jobNumber, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            }else{
                resolve(data);
            }
        });
    });
}

/**
 * 获取子目录路径
 * @param  {String} parentDirPath 父级目录路径
 * @return {String}               子目录路径
 */
function getSubDirPath(parentDirPath){
    const subDirs = fs.readdirSync(parentDirPath);
    if(subDirs.length>0){
        return `${parentDirPath}/${subDirs[0]}`;
    }else{
        throw new Error('无目标打包目录');
    }
}
/**
 * 拷贝文件夹
 * @param  {String} folder 要拷贝的文件夹名
 * @param  {String} originPath 要拷贝文件的原始目录
 * @param  {String} targetPath 要拷贝文件的目标目录
 */
function copyFiles(folder,originPath,targetPath,isFolderName){
    if(folder!==''&&folder!=undefined){
        let fol = folder.split('|');
        for(let folderName of fol){
            let originPathNew = `${originPath}/${folderName}`;
            let targetPathNew = `${targetPath}/${folderName}`;
            if(isFolderName===false){
                targetPathNew = `${targetPath}`;
            }
            if(fs.existsSync(originPathNew)){
                _.copy(originPathNew,targetPathNew);
            }
        }
    }
    
}
/**
 * 上传到FTP
 * @param  {Object} ftp ftp对象
 * @param  {String} revision svn版本号
 * @param  {String} originStaticPath 原始目录
 * @param  {String} originAppPath ftp上的目标目录
 * @param  {Object} app app对象
 */
function uploadFtp(ftp,revision,originStaticPath,originAppPath,app){
    return new Promise(function(resolve,reject){
        let ftpConfig = {
            host: ftp.host,
            port: ftp.port,
            username: ftp.username,
            password: ftp.password
        };
        let remoteFilePath = ftp.path;
        const sftp = new Client();
        sftp.connect(ftpConfig).then(() => {
            return sftp.mkdir(remoteFilePath, true);
        }).then((data) => {
            let targetStaticPath = `${remoteFilePath}/${app.name}_image_${revision}.tar.gz`;
            let targetAppPath = `${remoteFilePath}/${app.name}_${revision}.tar.gz`;
            sftp.put(originStaticPath,targetStaticPath);
            sftp.put(originAppPath,targetAppPath);
            resolve();
        }).catch((err) => {
            reject(err);
        });
    })
}
/**
 * 压缩文件夹
 * @param  {String} originPath 要压缩的原始目录
 * @return {String} targetPath 要压缩的目标目录
 * @return {String} text 压缩说明
 */
function packDirectory(originPath,targetPath,text){
    return new Promise(function(resolve,reject){
        let write = fs.createWriteStream;
        let pack = tarPack.pack;
        pack(originPath)
          .pipe(write(targetPath))
          .on('error', function (err) {
            reject(err);
          })
          .on('close', function () {
            console.log('pack '+text+' directory done');
            resolve();
          })
    });
}
/**
  * svn info 查看项目的svn信息
  * @param  {String} targetPath 要查看svn信息的项目路径
  * @return {Object} Promise对象
*/
function getSvnInfo(targetPath){
    //https://repo.ds.gome.com.cn:8443/svn/atg_poc/30_Coding/NewDevMode/trunk/gome-gfe/channel-web/demo
    return new Promise(function(resolve,reject){
        svnUltimate.commands.info(targetPath, {}, function(err,info){
            if(err){
                reject(err);
            }else{
                console.log("svn info : get svn info complete");
                resolve(info);
            }
        });
    });
}
/**
  * 执行command命令
  * @param {String} path 要执行命令的文件夹路径
  * @param {String} buildCommand 要执行的命令
*/
function execCommand(execParams){
    return new Promise(function(resolve,reject){
        let urls = execParams.projects.map(function(item){
            return `${execParams.TASK_DIR_SOURCE_PATH}/${item}`;
        });
        
        let execFileUrl = '';
        if(process.platform==='linux'){
            execFileUrl = path.join(__dirname,'bash/gfe-build.sh');
        }else{
            execFileUrl = path.join(__dirname,'bash/gfe-build.bat');
        }
        urls.unshift(execParams.buildCommand);
        child_proc.execFile(execFileUrl, urls, function(error, stdout, stderr) {
            if(error){
                reject(error);
            }else{
                for (let item of execParams.projects) {
                    let path = `${execParams.TASK_DIR_SOURCE_PATH}/${item}`;
                    if(path.indexOf('.svn')==-1){
                        try{
                            let configContent = JSON.parse(fs.readFileSync(`${execParams.TASK_DIR_SOURCE_PATH}/${item}/config.json`));
                            console.info(configContent);
                            let packageDir = configContent.packageDir;
                            let staticPath = configContent.projectPath;
                            let staticFolder = configContent.projectFolder;
                            let appendFiles = configContent.appAppend;
                            let appPath = configContent.appPath;
                            let appFolder = configContent.appFolder;
                            let appInnerAppend = configContent.appInnerAppend;
                            let projectAppend = configContent.projectAppend;
                            let projectInnerAppend = configContent.projectInnerAppend;
                            let tempStaticDir = '';
                            if(staticPath!=''){
                                //生成静态包前先删除静态包里的这层目录 start
                                //(不然静态包增量会越来越大) E:/myBuild/gfe/feapp/channel-web-uat-trunk/static/image/gmpro/2.0.0/channel/public
                                //[ 'gmpro', '2.0.0', 'cart', '2.3.8' ]
                                let staticPathNoTagVersion = staticPath.split('/');
                                //[ 'gmpro', '2.0.0', 'cart' ]
                                staticPathNoTagVersion.splice(staticPathNoTagVersion.length-1,1);
                                if(staticPathNoTagVersion){
                                    delFolder(execParams.TEMP_STATIC_PATH+'/image/'+staticPathNoTagVersion.join('/'));
                                }

                                //生成静态包前先删除静态包里的这层目录 end
                                
                                // tempStaticDir = `${execParams.TEMP_STATIC_PATH}/image/${staticPath}/${item}`;
                                tempStaticDir = `${execParams.TEMP_STATIC_PATH}/image/${staticPath}`;
                            }else{
                                tempStaticDir = `${execParams.TEMP_STATIC_PATH}/image`;
                            }
                            let tempAppDir = '';
                            if(appPath!=''){
                                // tempAppDir = `${execParams.TEMP_APP_PATH}/${execParams.app.name}/${appPath}/${item}`;
                                tempAppDir = `${execParams.TEMP_APP_PATH}/${execParams.app.name}/${appPath}`;
                            }else{
                                tempAppDir = `${execParams.TEMP_APP_PATH}/${execParams.app.name}`;
                            }
                            
                            // let tempStaticDir = `${execParams.TEMP_STATIC_PATH}/image/${staticPath}/${item}`;
                            // let tempAppDir = `${execParams.TEMP_APP_PATH}/${execParams.app.name}/${appPath}/${item}`;

                            _.mkdir(tempStaticDir); //创建TEMP_STATIC_PATH那层目录
                            _.mkdir(tempAppDir); //创建TEMP_APP_PATH那层目录

                            //拷贝config.json中配置的文件
                            //css|js,原目录，拷贝后的目录
                            copyFiles(staticFolder,`${execParams.TASK_DIR_SOURCE_PATH}/${item}/${packageDir}`,tempStaticDir);
                            copyFiles(appFolder,`${execParams.TASK_DIR_SOURCE_PATH}/${item}/${packageDir}`,`${tempAppDir}`,false);
                            copyFiles(appendFiles,`${execParams.TASK_DIR_SOURCE_PATH}/${item}`,`${execParams.TEMP_APP_PATH}/${execParams.app.name}`);
                            copyFiles(appInnerAppend,`${execParams.TASK_DIR_SOURCE_PATH}/${item}`,`${tempAppDir}`);
                            copyFiles(projectAppend,`${execParams.TASK_DIR_SOURCE_PATH}/${item}`,`${execParams.TEMP_STATIC_PATH}/image`);
                            copyFiles(projectInnerAppend,`${execParams.TASK_DIR_SOURCE_PATH}/${item}`,`${tempStaticDir}`);
                            resolve();
                        }catch(error){
                            console.log(error);
                            reject(error);
                        }
                    }
                }
            }
        });
    })
    
}
/**
  * 删除指定文件夹
  * @param {String} path 要删除的文件夹路径
*/
function delFolder(path){
    while(fs.existsSync(path)){
        try{
            _.del(path);
            fs.rmdirSync(path);
        }catch(error){}    
    }
}
/**
  * 根据任务的分支类型获取应用的svn路径
  * @param {Object} app 应用对象
  * @param {String} taskBranchType 任务分支类型
*/
function getAppSvnPath(app,taskBranchType){
    if(taskBranchType==="tag"){
        return app.tagPath;
    }
    if(taskBranchType==="master"){
        return app.masterPath;
    }
    if(taskBranchType==="branch"){
        return app.branchPath;
    }
}
/**
 * 获取SVN的子目录列表
 * @param  {String} svnUrl 被删除项目的svn路径
 * @return {Object} Promise对象
 */
function getSvnChildDirList(svnUrl) {
    return new Promise(function(resolve, reject) {
        svnUltimate.commands.list(svnUrl, {}, function(err, data) {
            if (err) {
                reject(err);
            } else {
                if(data.list.entry){
                    resolve(data.list.entry.constructor === Array ? data.list.entry : [data.list.entry]);    
                }else{
                    resolve([]);
                }
            }
        });
    });
}
/**
  * svn checkout 检出项目
  * @param  {String} originUrl 原始路径
  * @param  {String} targetPath 目标路径
  * @return {Object} Promise对象
*/
function checkoutSvnProject(originPath,targetPath){
    return new Promise(function(resolve, reject) {
        svnUltimate.commands.checkout( originPath, targetPath, function( err ) {
            if (err) {
                reject(err);
            } else {
                console.log("svn command : Checkout complete");
                resolve();
            }
        });
    });
}
/**
  * svn update 更新项目
  * @param  {String} targetPath 要更新的目标路径
  * @return {Object} Promise对象
*/
function updateSvnProject(targetPath){
    return new Promise(function(resolve, reject) {
        svnUltimate.commands.update( targetPath,{},
        function( err ) {
            if(err){
                reject(err);
            }else{
                console.log( "svn command : Update complete" );
                resolve();
            }
        });
    });
}
