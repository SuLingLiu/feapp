
const fs = require('fs');
const mongoose = require('mongoose');
const { wrap: async } = require('co');
const svnUltimate = require('node-svn-ultimate');
const tagLogModel = mongoose.model('tagLogModel');
const logger = require('log4js').getLogger();
const msg = require('../../utils/message');
const util = require('../../utils/util');
const systemParam = util.getSystemParam();
const systemConfig = util.getSystemConfig();
const _ = require('../../utils/fis-util');

/**
 * 根据查询条件获取Tag列表
 */
exports.getTagListByCriteria = async(function*(req, res) {
    try {
        const projectTagPath = req.query.projectTagPath;
        const svnChildDirList = yield getSvnChildDirList(projectTagPath);
        let tagList = [];
        svnChildDirList.forEach(function(item) {
            let tag = {};
            tag.tagName = item.name;
            tag.createdAt = item.commit.date;
            tag.creatorName = item.commit.author;
            tag.revision = item.commit.$.revision;
            tagList.push(tag);
        });
        util.sortByVersionNumber(tagList, 'tagName', true); //版本号倒序排列
        res.send(msg.genSuccessMsg('读取Tag列表成功', tagList));
    } catch (error) {
        logger.error(req.url, '读取Tag列表失败', error);
        res.send(msg.genFailedMsg('读取Tag列表失败'));
    }
});

/**
 * 根据Tag路径获取最新的Tag名称
 */
exports.getLatestTagNameByTagPath = async(function*(req, res) {
    try {
        const projectTagPath = req.query.projectTagPath;
        const svnChildDirList = yield getSvnChildDirList(projectTagPath);
        let tagList = svnChildDirList.map(function(item) {
            return item.name;
        });
        if(svnChildDirList.length > 0){
            util.sortByVersionNumber(tagList, null, true); //版本号倒序排列    
        }else{
            tagList = [''];
        }
        res.send(msg.genSuccessMsg('获取最新Tag名称成功', tagList[0]));
    } catch (error) {
        logger.error(req.url, '获取最新Tag名称失败', error);
        res.send(msg.genFailedMsg('获取最新Tag名称失败'));
    }
});

/**
 * 根据应用的SVN目录获取项目列表
 */
exports.getProjectListByAppPath = async(function*(req, res) {
    try {
        const appPath = req.query.appPath;
        const svnChildDirList = yield getSvnChildDirList(appPath);
        let projectList = svnChildDirList.map(function(item) {
            return { name: item.name };
        });
        res.send(msg.genSuccessMsg('读取项目列表成功', projectList));
    } catch (error) {
        logger.error(req.url, '读取项目列表失败', error);
        res.send(msg.genFailedMsg('读取项目列表失败'));
    }
});

/**
 * 创建Tag
 */
exports.createTag = async(function*(req, res) {
    let tagLog = new tagLogModel(req.body);
    try {
        let tempPath = `${systemConfig.configTempDir}/${req.body.projectName}`;
        _.del(tempPath);
        _.mkdir(tempPath);
        let tagOriginPath = req.body.tagOriginPath;
        yield modifyConfigVersion(tagOriginPath,tempPath,req.body.tagName);

        tagLog.createdBy = req.session.user.username;
        tagLog.operateType = systemParam.tagLogOperateType.constant.CREATE;
        yield copySvnProject(tagLog.tagOriginPath, tagLog.tagPath);//创建Tag
        yield tagLog.updateAndSave(); //记录Tag日志
        res.send(msg.genSuccessMsg('保存成功'));
    } catch (error) {
        //第一次打Tag，如果没有文件夹，需要创建文件夹
        if(~error.message.indexOf('E160013: File not found')){
            try{
                let tagPath = tagLog.tagPath;
                let tagProjectPath = tagPath.slice(0,tagPath.lastIndexOf('/'));
                let tagAppPath = tagProjectPath.slice(0,tagProjectPath.lastIndexOf('/'));
                try{
                    yield getSvnInfo(tagAppPath);
                }catch(error){
                    if(~error.message.indexOf("svn: E200009: Could not display info for all targets because some targets don't exist")){
                        yield createSvnDir(tagAppPath);
                    }else{
                        throw error;
                    }
                }
                try{
                    yield getSvnInfo(tagProjectPath);
                }catch(error){
                    if(~error.message.indexOf("svn: E200009: Could not display info for all targets because some targets don't exist")){
                        yield createSvnDir(tagProjectPath);
                    }else{
                        throw error;
                    }
                }
                yield copySvnProject(tagLog.tagOriginPath, tagLog.tagPath);//创建Tag
                res.send(msg.genSuccessMsg('保存成功'));
            }catch(error){
                logger.error(req.url, '保存Tag失败', error);
                res.send(msg.genFailedMsg('保存失败'));
            }
        }else{
            logger.error(req.url, '保存Tag失败', error);
            res.send(msg.genFailedMsg('保存失败'));
        }
    }
});

/**
 * 拷贝Tag
 */
exports.copyTag = async(function*(req, res) {
    try {
        let tagLog = new tagLogModel(req.body);
        tagLog.createdBy = req.session.user.username;
        tagLog.operateType = systemParam.tagLogOperateType.constant.COPY;
        yield copySvnProject(tagLog.tagOriginPath, tagLog.tagPath);//拷贝Tag
        yield tagLog.updateAndSave(); //记录Tag日志
        res.send(msg.genSuccessMsg('保存成功'));
    } catch (error) {
        logger.error(req.url, '拷贝Tag失败', error);
        res.send(msg.genFailedMsg('保存失败'));
    }
});

/**
 * 删除Tag
 */
exports.deleteTag = async(function*(req, res) {
    try {
        let tagLog = new tagLogModel(req.body);
        tagLog.createdBy = req.session.user.username;
        tagLog.operateType = systemParam.tagLogOperateType.constant.DELETE;
        yield deleteSvnProject(tagLog.tagPath);//删除Tag
        yield tagLog.updateAndSave(); //记录Tag日志
        res.send(msg.genSuccessMsg('删除成功'));
    } catch (error) {
        logger.error(req.url, '删除Tag失败!', error);
        res.send(msg.genFailedMsg('删除失败'));
    }
});

function modifyConfigVersion(originUrl, distUrl, tagName) {
    return new Promise(function(resolve, reject) {
        
        svnUltimate.commands.checkout(originUrl, distUrl ,{depth: "empty"}, function(err) {
            if (err) {
                reject(err);
            } else {
                svnUltimate.commands.update( distUrl+'/config.json', function(err){
                    if(err){
                        reject(err)
                    }else{
                        let configCon = JSON.parse(fs.readFileSync(distUrl+'/config.json','utf-8'));
                        var projectPaths = (configCon.projectPath).trim();
                        console.log(projectPaths);
                        console.log('projectPaths-------------------------------->'+projectPaths+'<');
                        if( projectPaths!='' ){
                            let projectPath = configCon.projectPath.split('/');
                            projectPath[projectPath.length-1] = tagName;
                            configCon.projectPath = projectPath.join('/');
                            fs.writeFileSync(distUrl+'/config.json', JSON.stringify(configCon,null,2), 'utf-8');

                            svnUltimate.commands.commit(distUrl+'/config.json',{
                                params: [systemConfig.svnDefaultComments]
                            },function(err){
                                if(err){
                                    reject(err)
                                }else{
                                    resolve();
                                }
                            });
                        }else{
                            resolve();
                        }
                    }
                });
            }
        });
    });
}

/**
 * 拷贝svn项目
 * @param  {String} originUrl 原始路径
 * @param  {String} distUrl   目标路径
 * @return {Object} Promise对象
 */
function copySvnProject(originUrl, distUrl) {
    return new Promise(function(resolve, reject) {
        if(originUrl === distUrl){
            resolve();
        }else{
            //先删除，防止copyBug，现象。第一遍正常执行，copy成功；第二遍copy到的目录路径的内部
            svnUltimate.commands.del(distUrl, { params: [systemConfig.svnDefaultComments] }, function(err, data) {
                svnUltimate.commands.copy(originUrl, distUrl, { params: [systemConfig.svnDefaultComments] }, function(err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });
        }
    });
}

/**
 * 删除svn项目
 * @param  {String} svnUrl 被删除项目的svn路径
 * @return {Object} Promise对象
 */
function deleteSvnProject(svnUrl) {
    return new Promise(function(resolve, reject) {
        svnUltimate.commands.del(svnUrl, { params: [systemConfig.svnDefaultComments] }, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
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
 * 创建SVN目录
 * @param  {String} svnUrl 待创建的svnUrl
 * @return {Object} Promise对象
 */
function createSvnDir(svnUrl){
    return new Promise(function(resolve, reject) {
        svnUltimate.commands.mkdir(svnUrl, { params: [systemConfig.svnDefaultComments] }, function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * 获取SVN文件夹的信息
 * @param  {String} svnUrl SVN的路径
 * @return {Object}     Promise对象
 */
function getSvnInfo(svnUrl) {
    return new Promise(function(resolve, reject) {
        svnUltimate.commands.info(svnUrl, {}, function(err, data) {
            if(err){
                reject(err);
            }else{
                resolve(data);
            }
        });
    });
}
