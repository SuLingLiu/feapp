const express = require('express');
const router = express.Router();
const { wrap: async } = require('co');
const mongoose = require('mongoose');
const sessionModel = mongoose.model('sessionModel');
const msg = require('../utils/message');
const authFilter = require('../utils/auth-filter');
const util = require('../utils/util');
const isLogin = authFilter.isLogin;
const systemParam = util.getSystemParam();
const systemConfig = util.getSystemConfig();

//��ת����ҳ(��������)
router.get('/', isLogin, function(req, res, next) {
    const userInfo = req.session.user;
    const nodeEnv = process.env.NODE_ENV;
    userInfo.roleName = systemParam.userRole.param[userInfo.role];
    res.render('index', { userInfo: userInfo, nodeEnv: nodeEnv });
});

//�˳���¼(��������)
router.get('/prd/logout', isLogin, function(req, res) {
    delete req.session.user;
    delete req.session.token;
    const logoutURL = systemConfig.sso.logoutURL;
    const redirectURL = `${req.protocol}://${req.headers.host}/prd/ssoProxyLogin`;
    const appKey = systemConfig.sso.appKey;
    const logoutFullURL = `${logoutURL}?redirectUrl=${redirectURL}&appKey=${appKey}`;
    res.redirect(logoutFullURL);
});

//sso��¼�����¼ҳ�棬������sign����
router.get('/prd/ssoProxyLogin', isLogin, function(req, res) {
    const indexURL = `${req.protocol}://${req.headers.host}/`;
    res.redirect(indexURL);
});

//�ض��򵽵�¼ҳ��(��������)
router.get('/prd/login', function(req, res) {
    const loginURL = systemConfig.sso.loginURL;
    const redirectURL = `${req.protocol}://${req.headers.host}/`;
    const appKey = systemConfig.sso.appKey;
    const loginFullURL = `${loginURL}?redirectUrl=${redirectURL}&appKey=${appKey}`;
    res.redirect(loginFullURL);
});

//���Ӧ�ýӿ�(��������)
router.post('/api/clearAppSession', async(function*(req, res) {
    const token = req.body.token;
    let result = { code: 1, msg: 'ɾ��ʧ��', data: {} };
    if (!token) {
        result.msg = 'token����Ϊ��';
        res.send(result);
    } else {
        try {
            const sessionList = sessionModel.getAllSessionList();
            const waitDeleteSessionIds = [];
            sessionList.forEach(function(item) {
                const session = JSON.parse(item.session);
                if (session.token && session.token === token) {
                    waitDeleteSessionIds.push(session._id);
                }
            });
            if (waitDeleteSessionIds.length > 0) {
                yield sessionModel.removeSessionByIds(waitDeleteSessionIds);
            }
            result.code = 0;
            result.msg = 'ɾ���ɹ�';
            res.send(result);
        } catch (error) {
            res.send(result);
        }
    }
}));

module.exports = router;
