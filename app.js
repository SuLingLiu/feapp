const express = require('express');
const path = require('path');
const log4js = require('log4js');
const logger = log4js.getLogger();
const ecstatic = require('ecstatic');
const favicon = require('serve-favicon');
const template = require('art-template');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const models = path.join(__dirname, 'mongodb/models');
const fs = require('fs');
const app = express();
const dbConfig = require('./utils/config/db-config');

//����mongodb���ݿ�
let dbConnect = dbConfig.prdDBConnnect;
if (process.env.DB_ENV === 'local') {
    dbConnect = dbConfig.localDBConnnect;
}
if (process.env.DB_ENV === 'test') {
    dbConnect = dbConfig.testDBConnnect;
}
mongoose.connect(dbConnect);
//ע��mongooseģ�ͣ��뱣������˳����������ģ����ǰ
require('./mongodb/models/sessionModel');
require('./mongodb/models/ftpModel');
require('./mongodb/models/appModel');
require('./mongodb/models/userModel');
require('./mongodb/models/scheduleModel');
require('./mongodb/models/taskModel');
require('./mongodb/models/userTaskMapModel');
require('./mongodb/models/scheduleLogModel');
require('./mongodb/models/tagLogModel');
require('./mongodb/models/versionDeleteLogModel');
require('./mongodb/models/taskBuildLogModel');

const authFilter = require('./utils/auth-filter');
const prdRoute = require('./routes/prd');
const devRoute = require('./routes/dev');
const apiRoute = require('./routes/api');
// ����ģ������
app.set('views', path.join(__dirname, 'views'));
template.config('base', '');
template.config('extname', '.html');
app.engine('.html', template.__express);
app.set('view engine', 'html');
app.use(favicon(path.join(__dirname, 'favicon.ico')));
app.use(log4js.connectLogger(log4js.getLogger('http'), { level: 'auto', format: ':method :url :status :response-time ms' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'feapp', resave: true, saveUninitialized: true, store: new MongoStore({ mongooseConnection: mongoose.connection, collection: 'sessionmodels' }) }));
if (app.get('env') === 'prd') {
    app.use('/', prdRoute);
} else {
    app.use('/', devRoute);
}
app.use('/api', authFilter.isLogin, apiRoute);
app.use(ecstatic({ root: path.join(__dirname, 'logs'), baseDir: '/logs' }));

//��������������������
if (app.get('env') === 'dev') {
    app.use(function(req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
    app.use(function(err, req, res, next) {
        logger.error(req.url, err);
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
} else {
    //���ϻ���������������
    app.use(function(err, req, res, next) {
        if (err.status !== 404) {
            logger.error(req.url, err);
        }
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });
}

//��ʱ����������
if (app.get('env') === 'prd') {
    const systemConfig = require('./utils/util').getSystemConfig();
    const cron = systemConfig.prdDBBackupInfo.cron;
    const execScriptPath = systemConfig.prdDBBackupInfo.execScriptPath;
    require('node-schedule').scheduleJob(cron, function() {
        require('child_process').execFile(execScriptPath, function(error, stdout, stderr) {
            if (error) {
                logger.error('����������ʧ�ܣ�', error);
            }
        });
    });
}



module.exports = app;
