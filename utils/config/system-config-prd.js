/**
 * prd环境系统配置
 */
module.exports = {
    //构建项目根路径
    buildProjectRootDir: "/feapp-build",
    //sso信息
    sso: {
        //appKey
        appKey: "0570bc6b54a944f086dcefbd78b091ac",
        //登录页面URL
        loginURL: "http://popeye.ds.gome.com.cn/app/login",
        //退出页面URL
        logoutURL: "http://popeye.ds.gome.com.cn/app/logout",
        //反向校验Token的接口地址
        verifyTokenURL: "http://popeye.ds.gome.com.cn/app/token"
    },
    //生产库备份信息
    prdDBBackupInfo: {
        //cron表达式：每天的5点备份一次
        cron: '0 0 5 * * *',
        //备份脚本路径
        execScriptPath: '/feapp-mongodb-bak/feapp-prd-bak.sh'
    },
    //config.json文件暂时存放地址
    configTempDir:"/feapp-temp",
    //映射目录(服务器上传到FTP包时，不需要连接服务器，做了服务器目录映射，可以直接拷贝文件到ftp映射的目录)
    mapUrl:"/app/release/atg_poc/gome-feapp"
}
