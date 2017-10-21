#!/bin/bash  
#备份生产库数据库
  
#mongodump命令路径  
DUMP=mongodump  
#临时备份目录  
OUT_DIR=/feapp-mongodb-bak/feapp-prd-bak-temp 
#备份存放路径  
TAR_DIR=/feapp-mongodb-bak/feapp-prd-bak-list
#获取当前系统时间  
DATE=`date +%Y%m%d`  
#数据库账号  
DB_USER=nicai
#数据库密码  
DB_PASS=nicai
#要备份的数据库
DB=feapp-prd
#授权的数据库
AUTH_DB=feapp-prd
#DAYS=10代表删除10天前的备份，即只保留近10天的备份  
DAYS=10  
#最终保存的数据库备份文件  
TAR_BAK="mongodb-bak-$DATE.tar.gz"  
  
cd $OUT_DIR  
rm -rf $OUT_DIR/*  
mkdir -p $OUT_DIR/$DATE  
cd $OUT_DIR/$DATE
#备份数据库
$DUMP --host 10.58.57.5:27017 --username $DB_USER --password $DB_PASS --db $DB --authenticationDatabase $AUTH_DB --out $OUT_DIR/$DATE  
#压缩为.tar.gz格式  
tar -zcvf $TAR_DIR/$TAR_BAK $DB
#删除15天前的备份文件  
find $TAR_DIR/ -mtime +$DAYS -delete  
  
exit