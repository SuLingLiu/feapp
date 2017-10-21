const mongoose = require('mongoose');
const userTaskMapModel = mongoose.model('userTaskMapModel');
const { wrap: async } = require('co');
const msg = require('../../utils/message');
const logger = require('log4js').getLogger();

/**
 * ͨ������ID��ȡ�û��б�
 */
exports.getUserListByTaskId = async(function*(req, res) {
    try {
        const taskId = req.query.taskId;
        var userList = yield userTaskMapModel.getUserListByTaskId(taskId);
        res.send(msg.genSuccessMsg('��ȡ�û��б�ɹ�', userList));
    } catch (error) {
        logger.error(req.url, '��ȡ�û��б�ʧ��', error);
        res.send(msg.genFailedMsg('��ȡ�û��б�ʧ��'));
    }
});

/**
 * ͨ���û�ID��ȡ��ǰѡ������
 */
exports.getTaskListByUserId = async(function*(req, res) {
    try {
        const userId = req.query.userId;
        var taskList = yield userTaskMapModel.getTaskListByUserId(userId);
        res.send(msg.genSuccessMsg('��ȡ�����б�ɹ�', taskList));
    } catch (error) {
        logger.error(req.url, '��ȡ�����б�ʧ��', error);
        res.send(msg.genFailedMsg('��ȡ�����б�ʧ��'));
    }
});

