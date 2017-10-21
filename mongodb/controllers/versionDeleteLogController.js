const mongoose = require('mongoose');
const logger = require('log4js').getLogger();
const versionDeleteLogModel = mongoose.model('versionDeleteLogModel');
const userTaskMapModel = mongoose.model('userTaskMapModel');
const taskModel = mongoose.model('taskModel');
const underscore = require('underscore');
const { wrap: async } = require('co');
const msg = require('../../utils/message');
const util = require('../../utils/util');

/**
 * 根据查询条件获取版本删除日志列表
 */
exports.getVersionDeleteLogListByCriteria = async(function*(req, res) {
    try {
        let query = {
            page: parseInt(req.query.page) - 1,
            limit: parseInt(req.query.limit),
            search: {}
        }
        if (req.query.appId && req.query.appId !== '') {
            query.search.appIdList = [req.query.appId];
        }else{
            let user = req.session.user;
            let isAdmin = util.isAdmin(user);
            if(!isAdmin){
                let taskList = yield userTaskMapModel.getTaskListByUserId(user._id);
                let taskIdList = taskList.map(function(item){
                    return item.task._id;
                });

                let tasks = yield taskModel.getTaskListByTaskIds(taskIdList);
                let appIdList = tasks.map(function(item){
                    return item.app.toString();
                });
                appIdList = underscore.uniq(appIdList);
                query.search.appIdList = appIdList;            }
        }
        if (req.query.taskName && req.query.taskName !== '') {
            query.search.taskName = req.query.taskName;
        }
        if (req.query.taskId && req.query.taskId !== '') {
            query.search.taskId = req.query.taskId;
        }
        if (req.query.versionName && req.query.versionName !== '') {
            query.search.versionName = req.query.versionName;
        }
        if (req.query.createdBy && req.query.createdBy !== '') {
            query.search.createdBy = req.query.createdBy;
        }
        if (req.query.createdAtStart && req.query.createdAtStart !== '') {
            query.search.createdAtStart = req.query.createdAtStart;
            query.search.createdAtEnd = req.query.createdAtEnd;
        }
        const [count, list] = yield versionDeleteLogModel.getTagLogListByCriteria(query);
        res.send(msg.genSuccessMsg('读取版本删除日志列表成功', list, {
            count: count
        }));
    } catch (error) {
        logger.error(req.url, '读取版本删除日志列表失败', error);
        res.send(msg.genFailedMsg('读取版本删除日志列表失败'));
    }
});
