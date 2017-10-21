/**
 * 系统配置
 */
module.exports = {
    //svn默认注释
    svnDefaultComments: '-m "113099:gfe auto tag:image"',
    //存放临时静态文件夹名字
    tempStaticDirName: "static",
    //存放临时应用文件夹名字
    tempAppDirName: "app",
    //存放临时应用源码文件夹名字
    tempAppSourceDirName: "source",
    //项目svn路径
    gfeProjectSvn: "https://code.ds.gome.com.cn/svn/atg_poc/30_Coding/NewDevMode/trunk/gome-gfe/",
    //合包job名
    combineJenkinsName:"feapp-build",
    combineJenkinsPath:"10.58.22.45:8080",
    combineJenkinsUserName:"stage",
    combineJenkinsPassword:"1234567"
}
