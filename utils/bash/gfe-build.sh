#获取所有参数，例如：['gfe b -uat -all','/app/item-web/item','/app/item-web/item-test']
args=$@
#获取第一个参数执行命令
cmd=$1
for i in $(echo ${args}|awk '{for(i=2;i<=NF;++i) printf $i "\t";printf "\n"}'); do
    cd ${i} && ${cmd}
done

