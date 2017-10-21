const fs = require('fs');
const mongoose = require('mongoose');
const { wrap: async } = require('co');
const logger = require('log4js').getLogger();
const versionDeleteLogModel = mongoose.model('versionDeleteLogModel');
const taskModel = mongoose.model('taskModel');
const msg = require('../../utils/message');
const Client = require('ssh2-sftp-client');
const util = require('../../utils/util');
const systemConfig = util.getSystemConfig();
const _ = require('../../utils/fis-util');

/**
 * 根据查询条件获取版本列表
 */
exports.getVersionListByTaskId = async(function*(req, res) {
    try {
        // const sftp = new Client();
        const taskId = req.query.taskId;
        const task = yield taskModel.getTaskById(taskId);
        const app = task.app;
        // yield sftp.connect(task.ftp);
        // const taskFtpPath = task.ftp.path;
        const downloadPath = task.ftp.path.replace('/app/release','http://bin.ds.gome.com.cn');
        // let fileList = yield sftp.list(taskFtpPath);
        let fileList = [];
        let env = (task.ftp.name).indexOf('PRD')==-1 ? 'uat' : 'prd';
        let packageUrl = systemConfig.mapUrl+'/'+env+'/'+app.name;
        fs.readdirSync(packageUrl).forEach(function(p) {
            fileList.push(p);
        });
        const taskName = task.name;
        const appId = task.app._id;
        const appName = task.app.name;
        const versionList = fileList.filter(function(item) {
            return item.type != 'd' && item.endsWith('.tar.gz'); //过滤掉文件夹，只保留文件
        }).map(function(item) {
            let citem = packageUrl+'/'+item;
            let stat = fs.statSync(citem);
            let date = new Date(stat.mtime);
            return {
                downloadPath: downloadPath,
                taskId: taskId,
                taskName: taskName,
                appId: appId,
                appName: appName,
                name: item,
                createdAt: date.getTime()
            };
        }).sort(function(preItem, curItem) {
            const preCreatedAt = Number(preItem.createdAt);
            const curCreatedAt = Number(curItem.createdAt);
            if (preCreatedAt < curCreatedAt) {
                return 1;
            } else if (preCreatedAt > curCreatedAt) {
                return -1;
            }
            return 0;
        });
        res.send(msg.genSuccessMsg('读取版本列表成功', versionList));
    } catch (error) {
        logger.error(req.url, '获取版本列表失败', error);
        res.send(msg.genFailedMsg('读取版本列表失败'));
    }
});

/**
 * 删除版本
 */
exports.deleteVersion = async(function*(req, res) {
    try {
        // const sftp = new Client();
        let versionDeleteLog = new versionDeleteLogModel(req.body);
        versionDeleteLog.createdBy = req.session.user.username;
        const taskId = req.body.task;
        const versionName = req.body.versionName;
        const task = yield taskModel.getTaskById(taskId);
        // yield sftp.connect(task.ftp);
        // yield sftp.delete(`${task.ftp.path}/${versionName}`);
        const app = task.app;
        let env = (task.ftp.name).indexOf('PRD')==-1 ? 'uat' : 'prd';
        let packageUrl = systemConfig.mapUrl+'/'+env+'/'+app.name;
        _.del(`${packageUrl}/${versionName}`);
        yield versionDeleteLog.updateAndSave(); //记录版本删除日志
        res.send(msg.genSuccessMsg('删除成功'));
    } catch (error) {
        logger.error(req.url, '删除版本失败', error);
        res.send(msg.genFailedMsg('删除失败'));
    }
});
