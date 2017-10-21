#!/bin/bash  
#把生产库回复到测试库
  
#mongodump命令  
DUMP=mongodump  
#mongorestore命令
RESTORE=mongorestore
#临时备份目录  
OUT_DIR=/feapp-mongodb-bak/temp
#备份存放路径  
TAR_DIR=/feapp-mongodb-bak/feapp-prd-bak-list
#获取当前系统时间  
DATE=`date +%Y%m%d`  
#生产数据库账号  
PRD_DB_USER=nicai  
#生产数据库密码  
PRD_DB_PASS=nicai
#要备份的生产数据库
PRD_DB=feapp-prd
#授权的生产数据库
PRD_AUTH_DB=feapp-prd
#要备份的数测试据库
LOCAL_DB=feapp-local

cd $OUT_DIR  
rm -rf $OUT_DIR/*  
mkdir -p $OUT_DIR/$DATE  
cd $OUT_DIR/$DATE
#备份生产数据库
$DUMP --host 10.58.57.5:27017 --username $PRD_DB_USER --password $PRD_DB_PASS --db $PRD_DB --authenticationDatabase $PRD_AUTH_DB --out $OUT_DIR/$DATE  
#恢复到测试数据库
$RESTORE --host $1:27017 --db $LOCAL_DB --noIndexRestore --drop --dir $PRD_DB
  
exit
