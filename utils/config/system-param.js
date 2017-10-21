/**
 * 系统参数表
 */
module.exports = {
    //用户角色
    userRole: {
        constant: {
            COMMON_USER: "user",
            ADMIN: "admin"
        },
        param: {
            "user": "普通用户",
            "admin": "管理员"
        }
    },
    //打包状态
    buildStatus: {
        constant: {
            STEP1SUCCESS:"step1success",
            STEP1FAILED:"step1failed",
            STEP2SUCCESS:"step2success",
            STEP2FAILED:"step2failed",
            STEP3SUCCESS:"step3success",
            STEP3FAILED:"step3failed"
        },
        param: {
            "step1success":"打包成功",
            "step1failed":"打包失败",
            "step2success":"合包成功",
            "step2failed":"合包失败",
            "step3success":"发包成功",
            "step3failed":"发包失败"
        }
    },
    //Tag日志操作类型
    tagLogOperateType: {
        constant: {
            CREATE: "create",
            COPY: "copy",
            DELETE: "delete"
        },
        param: {
            "create": "创建Tag",
            //"copy": "拷贝Tag",
            "delete": "删除Tag"
        }
    },
    //版本控制系统类型
    vcsType: {
        constant: {
            GIT: "git",
            SVN: "svn"
        },
        param: {
            "git": "Git",
            "svn": "Svn"
        }
    },
    //分支类型
    branchType: {
        constant: {
            MASTER: "master",
            BRANCH: "branch",
            TAG: "tag"
        },
        param: {
            "master": "Master",
            "branch": "Branch",
            "tag": "Tag"
        }
    },
    //调度类型
    scheduleType: {
        constant: {
            DELETE_PACKAGE: "delete-package",
            BACKUP_DB: "backup-db"
        },
        param: {
            "delete-package": "定时删包",
            "backup-db": "定时备份数据库"
        }
    },
    //调度执行结果类型
    scheduleExecuteResultType: {
        constant: {
            FAIL: "fail",
            SUCCESS: "success"
        },
        param: {
            "fail": "执行失败",
            "success": "执行成功"
        }
    },
    //调度日志类型
    scheduleLogType: {
        constant: {
            MANUAL: "manual",
            AUTOMATIC: "automatic"
        },
        param: {
            "manual": "手动执行",
            "automatic": "自动执行"
        }
    }
};
