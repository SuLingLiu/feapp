<template>
  <section>
    <!--工具条-->
    <el-col :span="24" class="toolbar">
      <el-form :inline="true" :model="searchForm" ref="searchForm" id="searchForm" class="demo-form-inline" @submit.prevent>
        <el-form-item label="任务名称">
          <el-input v-model="searchForm.taskSearchKey" placeholder="请输入任务名称" @keyup.enter.native="search"></el-input>
        </el-form-item>
        <el-form-item>
          <el-input v-show="false"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="search" @click="search">查询</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="plus" @click="handleAdd">新增任务</el-button>
        </el-form-item>
      </el-form>
    </el-col>

    <!--表格-->
    <template>
      <!--data按照指定数组格式传进来就会自动渲染表格数据-->
      <!--v-loading为真时，显示loading动画-->
      <el-table :data="tableData" highlight-current-row v-loading="listLoading" style="width: 100%;">
        <el-table-column prop="name" label="任务名称">
        </el-table-column>
        <el-table-column prop="app.name" label="应用名称">
        </el-table-column>
        <el-table-column prop="branchType" label="应用分支">
        </el-table-column>
        <el-table-column prop="ftp.name" label="FTP">
        </el-table-column>
        <el-table-column prop="isCombinePackage" label="合包(是/否)" :formatter="formatterCombine">
        </el-table-column>
        <el-table-column prop="isPublish" label="发版(是/否)" :formatter="formatterPublish">
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" :formatter="formatDate">
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template scope="scope">
            <el-button type="text" size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="text" size="small" @click="handleDel(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <!--分页-->
    <el-col :span="24" class="toolbar" style="padding-bottom:10px;">
      <el-pagination
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            :current-page="currentPage"
            :page-sizes="[20, 40, 100]"
            :page-size="currentPageSize"
            layout="total, sizes, prev, pager, next, jumper"
      :total="tableDataLength"
            style="float:right">
      </el-pagination>
    </el-col>

    <!--编辑模态框-->
    <!--el-dialog的v-model绑定一个boolean值，表示显示或者隐藏-->
    <el-dialog :title="editFormTtile" v-model="editFormVisible" :close-on-click-modal="true">
      <el-form :model="editForm" label-width="120px" :rules="editFormRules" ref="editForm" style="width:85%;margin:0 auto;">
        <h4>基本信息</h4>
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="editForm.name" auto-complete="off"></el-input>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="editForm.remark" auto-complete="off"></el-input>
        </el-form-item>
        <el-form-item label="应用名称" prop="appId">
          <el-select v-model="editForm.appId" placeholder="请选择应用" @change="getAllBranchType">
            <el-option v-for="item in editForm.appList" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="应用分支" prop="branchType">
          <el-select v-model="editForm.branchType" placeholder="请选择分支">
            <el-option v-for="item in allBranchType" :label="item" :value="item"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="命令行" prop="command">
          <el-input v-model="editForm.command" auto-complete="off"></el-input>
        </el-form-item>
        <el-form-item label="用户权限" prop="currentUsers">
          <template>
              <el-select v-model="currentUsers" multiple placeholder="请选择" style="width:76%;">
                <el-option
                  v-for="item in editForm.users"
                  :label="item.name"
                  :value="item.id">
                </el-option>
              </el-select>
              <el-button @click="selectAllUser">所有用户</el-button>
            </template>
        </el-form-item>
        <h4>FTP</h4>
        <el-form-item label="配置信息" prop="ftpId">
          <el-select v-model="editForm.ftpId" placeholder="请选择ftp">
            <el-option v-for="item in editForm.ftp" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <h4>合包设置</h4>
        <el-form-item label="是否合包">
          <!--el-radio-group的v-model对应其子元素的label值-->
          <el-radio-group v-model="editForm.isCombinePackage">
            <el-radio class="radio" :label="true">是</el-radio>
            <el-radio class="radio" :label="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="editForm.isCombinePackage" label="后端包路径" prop="backEndPackagePath">
          <el-input v-model="editForm.backEndPackagePath" auto-complete="off"></el-input>
        </el-form-item>
        <h4>发版设置</h4>
        <el-form-item label="是否发版">
          <!--el-radio-group的v-model对应其子元素的label值-->
          <el-radio-group v-model="editForm.isPublish">
            <el-radio class="radio" :label="true">是</el-radio>
            <el-radio class="radio" :label="false" >否</el-radio>
          </el-radio-group>
        </el-form-item>
        <!-- <el-form-item label="jog地址" prop="jobPath">
          <el-input v-model="editForm.jobPath" auto-complete="off"></el-input>
        </el-form-item> -->
        <div v-if="editForm.isPublish" >
        <el-form-item label="Jenkins" prop="jenkinsPath">
          <el-input v-model="editForm.jenkinsPath" auto-complete="off"></el-input>
        </el-form-item>
        <el-form-item label="Username" prop="jenkinsUsername">
          <el-input v-model="editForm.jenkinsUsername" auto-complete="off"></el-input>
        </el-form-item>
        <el-form-item label="Password" prop="jenkinsPassword">
          <el-input v-model="editForm.jenkinsPassword" auto-complete="off"></el-input>
        </el-form-item>
        <el-form-item label="Job" prop="jenkinsName">
          <el-input v-model="editForm.jenkinsName" auto-complete="off"></el-input>
        </el-form-item>
        <el-form-item label="Parameters 01">
          <el-input v-model="editForm.jobFirstParamKey" auto-complete="off" style="width:100px;"></el-input>
          <!-- <el-input v-model="editForm.jobFirstParamValue" auto-complete="off" style="width:200px;"></el-input> -->
        </el-form-item>
        <el-form-item label="Parameters 02">
          <el-input v-model="editForm.jobSecondParamKey" auto-complete="off" style="width:100px;"></el-input>
          <el-input v-model="editForm.jobSecondParamValue" auto-complete="off" style="width:200px;"></el-input>
        </el-form-item>
        <el-form-item label="Parameters 03">
          <el-input v-model="editForm.jobThirdParamKey" auto-complete="off" style="width:100px;"></el-input>
          <el-input v-model="editForm.jobThirdParamValue" auto-complete="off" style="width:200px;"></el-input>
        </el-form-item>
        </div>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="editFormVisible = false">取 消</el-button>
        <el-button type="primary" @click="editSubmit" :loading="editLoading">{{btnEditText}}</el-button> 
      </div>
    </el-dialog>
  </section>
</template>

<script>
    import NProgress from 'nprogress';
    import axios from 'axios';
    import moment from 'moment';
    export default {
        data() {
            let exist = (rule, value, callback) => {
              let _this = this;
                if (value === '') {
                    callback(new Error('请输入任务名称'));
                } else {
                    axios.get('/api/task/isExistTaskName',{params:{taskName:value}}).then(function(res){
                        if(!res.data.success && _this.editFormTtile!=value){
                          callback(new Error('任务名称已经存在!'));
                        }else{
                          callback();
                        }
                    });
                }
            };
            let validateBackEndPackagePath = (rule, value, callback) => {
              let _this = this;
                if (value === '' && _this.editForm.isCombinePackage) {
                    callback(new Error('请输入后端包路径!'));
                } else {
                    callback();
                }
            };
            let isPublishValidate = (rule, value, callback) => {
              let _this = this;
                if (value === '' && _this.editForm.isPublish) {
                    callback(new Error('请输入jenkins地址'));
                } else {
                    callback();
                }
            };
            let isPublishJobValidate = (rule, value, callback) => {
              let _this = this;
                if (value === '' && _this.editForm.isPublish) {
                    callback(new Error('请输入job名'));
                } else {
                    callback();
                }
            };
            let isPublishUsernameValidate = (rule, value, callback) => {
              let _this = this;
                if (value === '' && _this.editForm.isPublish) {
                    callback(new Error('请输入jenkins用户名'));
                } else {
                    callback();
                }
            };
            let isPublishPasswordValidate = (rule, value, callback) => {
              let _this = this;
                if (value === '' && _this.editForm.isPublish) {
                    callback(new Error('请输入jenkins密码'));
                } else {
                    callback();
                }
            };
            return {
                editFormVisible:false,//编辑界面显是否显示
                editFormTtile:'编辑',//编辑界面标题
                currentUsers:[],
                allBranchType:[],
                users:[],
                searchForm:{
                  taskSearchKey:''
                },
                //编辑界面数据
                editForm: {
                    _id:0,
                    name: '',
                    remark:'',
                    branchType: '',
                    command:'',
                    ftp:[],
                    ftpId:'',
                    isCombinePackage:false,
                    backEndPackagePath:'',
                    isPublish:false,
                    jobPath:'',
                    jenkinsPath:'',
                    jenkinsName:'',
                    jenkinsUsername:'',
                    jenkinsPassword:'',
                    appList:[],
                    users:[],
                    jobFirstParamKey:'',
                    jobFirstParamValue:'',
                    jobSecondParamKey:'',
                    jobSecondParamValue:'',
                    jobThirdParamKey:'',
                    jobThirdParamValue:'',
                    appId:''
                },
                editLoading:false,
                btnEditText:'保 存',
                editFormRules:{
                    name:[
                        {  required: true, validator: exist,trigger: 'blur' }
                    ],
                    appId:[
                        { required: true, message: '请选择应用' }
                    ],
                    branchType:[
                        { required: true, message: '请选择分支' }
                    ],
                    ftpId:[
                        { required: true, message: '请选择ftp配置' }
                    ],
                    backEndPackagePath:[
                        { required: true,validator: validateBackEndPackagePath, trigger: 'blur' }
                    ],
                    jenkinsPath:[
                        { required: true,validator: isPublishValidate, trigger: 'blur' }
                    ],
                    jenkinsName:[
                        { required: true,validator: isPublishJobValidate, trigger: 'blur' }
                    ],
                    jenkinsUsername:[
                        { required: true,validator: isPublishUsernameValidate, trigger: 'blur' }
                    ],
                    jenkinsPassword:[
                        { required: true,validator: isPublishPasswordValidate, trigger: 'blur' }
                    ],
                    command:[
                        { required: true, message: '请输入命令行' }
                    ]
                },
                tableData:[],
                tableDataLength : 0,
                listLoading:false,
                currentPage:1,
                currentPageSize:20,
                isSelectAllUser:false
            };
        },
        created:function(){
            this.getTaskList();
            this.getAppList();
            this.getFtpList();
            this.getUserList();
        },
        methods: {
            //查询
            search:function(){
                this.getTaskList();
                return false;
            },
            clearCombine: function(){
              let _this = this;
              _this.editForm.backEndPackagePath = '';
            },
            clearPublish: function(){
              let _this = this;
              _this.editForm.jenkinsPath = '';
              _this.editForm.jenkinsName = '';
              _this.editForm.jenkinsUsername = '';
              _this.editForm.jenkinsPassword = '';
              _this.editForm.jobFirstParamKey = '';
              _this.editForm.jobSecondParamKey = '';
              _this.editForm.jobSecondParamValue = '';
              _this.editForm.jobThirdParamKey = '';
              _this.editForm.jobThirdParamValue = '';
            },
            //格式化布尔值(是/否)
            formatterCombine: function(row){
              return row.isCombinePackage===true ? '是' : '否';
            },
            //格式化是否发包
            formatterPublish: function(row){
              return row.isPublish===true ? '是' : '否';
            },
            //格式化日期
            formatDate: function(row, column) {
                return moment(row.createdAt).format('YYYY-MM-DD HH:mm:ss');
            },
            //获取所有分支类型
            getAllBranchType:function(){
              let _this = this;
              let params = {appId:_this.editForm.appId};
              if(_this.editForm.appId!=''){
                axios.get(`/api/task/getAllBranchTypeByAppId`,{params:params}).then(function(res){
                    if(res.data.success){
                      _this.allBranchType = res.data.data;
                    }else{
                      _this.$message({
                          message:res.data.msg,
                          type: 'error'
                      });
                    }
                })
              }
              
            },
            //删除记录
            handleDel:function(row){
                let _this=this;
                this.$confirm('确认删除该记录吗?', '提示', {
                    type: 'warning'
                }).then(() => {
                    _this.listLoading=true;
                    NProgress.start();
                    axios.delete(`/api/task/deleteTask/${row._id}`).then(function(res){
                        if(res.data.success){
                            _this.$message({
                                message:res.data.msg,
                                type: 'success'
                            });
                            _this.listLoading=false;
                            NProgress.done();
                            _this.getTaskList();
                        }else{
                            _this.$message({
                                message:res.data.msg,
                                type: 'error'
                            });
                        }
                    });
                }).catch(() => {

                });
            },
            selectAllUser:function(){ //全选、反选所有用户
              this.isSelectAllUser = false;
              if(this.currentUsers.length == this.editForm.users.length){
                this.isSelectAllUser = true;
              }
              this.isSelectAllUser = !this.isSelectAllUser;
              let users = [];
              this.editForm.users.forEach(function(item){
                users.push(item.id);
              });
              this.currentUsers = this.isSelectAllUser ? users :[];
            },
            //显示编辑界面
            handleEdit:function(row){
              let _this = this;
              _this.editFormVisible = true;
              _this.editFormTtile = row.name;
              _this.editForm.id = row._id;
              _this.editForm.name = row.name;
              _this.editForm.remark = row.remark;
              _this.editForm.appId = row.app!=undefined ? row.app._id : '';
              _this.editForm.branchType = row.branchType;
              _this.editForm.command = row.command;
              _this.editForm.ftpId = row.ftp!=undefined ? row.ftp._id : '';
              _this.editForm.isCombinePackage = row.isCombinePackage;
              _this.editForm.isPublish = row.isPublish;
              _this.editForm.backEndPackagePath = row.backEndPackagePath;
              _this.editForm.jenkinsPath = row.jenkinsPath;
              _this.editForm.jenkinsName = row.jenkinsName;
              _this.editForm.jenkinsUsername = row.jenkinsUsername;
              _this.editForm.jenkinsPassword = row.jenkinsPassword;
              _this.editForm.jobFirstParamKey = row.jobFirstParamKey;
              _this.editForm.jobFirstParamValue = row.jobFirstParamValue;
              _this.editForm.jobSecondParamKey = row.jobSecondParamKey;
              _this.editForm.jobSecondParamValue = row.jobSecondParamValue;
              _this.editForm.jobThirdParamKey = row.jobThirdParamKey;
              _this.editForm.jobThirdParamValue = row.jobThirdParamValue;
              
              _this.getAllBranchType();

              let url = '/api/usertaskmap/getUserListByTaskId';
              let params = {taskId:row._id};
              axios.get(url,{params:params}).then(function(res){
                if(res.data.success){
                  _this.currentUsers = [];
                  res.data.data.forEach(function(item){
                    _this.currentUsers.push(item.user._id);
                  });
                  _this.reSortUsers();//重排用户权限
                }else{
                  _this.$message({
                      message:res.data.msg,
                      type: 'error'
                  });
                }
              });
            },
            //编辑 or 新增
            editSubmit:function(){
                let _this=this;
                _this.$refs.editForm.validate((valid)=>{
                    if(valid){
                        _this.$confirm('确认提交吗？','提示',{}).then(()=>{
                            _this.editLoading=true;
                            NProgress.start();
                            _this.btnEditText='提交中';
                            let userData = {
                                name: _this.editForm.name,
                                remark: _this.editForm.remark,
                                branchType: _this.editForm.branchType,
                                app: _this.editForm.appId,
                                ftp: _this.editForm.ftpId,
                                command: _this.editForm.command,
                                isCombinePackage: _this.editForm.isCombinePackage,
                                backEndPackagePath: _this.editForm.backEndPackagePath,
                                isPublish: _this.editForm.isPublish,
                                jenkinsPath: _this.editForm.jenkinsPath,
                                jenkinsName: _this.editForm.jenkinsName,
                                jenkinsUsername: _this.editForm.jenkinsUsername,
                                jenkinsPassword: _this.editForm.jenkinsPassword,
                                currentUsers: _this.currentUsers,
                                jobFirstParamKey: _this.editForm.jobFirstParamKey,
                                jobFirstParamValue: _this.editForm.jobFirstParamValue,
                                jobSecondParamKey: _this.editForm.jobSecondParamKey,
                                jobSecondParamValue: _this.editForm.jobSecondParamValue,
                                jobThirdParamKey: _this.editForm.jobThirdParamKey,
                                jobThirdParamValue: _this.editForm.jobThirdParamValue
                            };
                            let url = _this.editForm.id?'/api/task/updateTask/'+_this.editForm.id :'/api/task/createTask';
                            axios.post(url,userData).then(function(res){
                                if(res.data.success){
                                    _this.$message({
                                        message:res.data.msg,
                                        type: 'success'
                                    });
                                    _this.editFormVisible = false;
                                    _this.getTaskList();
                                }else{
                                     _this.$message({
                                        message:res.data.msg,
                                        type: 'error'
                                    });
                                }
                                _this.btnEditText='提 交';
                                _this.editLoading=false;
                                NProgress.done();
                            });
                        });
                    }
                });

            },
            reSortUsers:function(){
              let _this = this;
              let editFormUsersChecked = [];
              let editFormUsersUnchecked = [];
              _this.editForm.users.forEach(function(item){
                if(_this.currentUsers.indexOf(item.id)!=-1){
                  editFormUsersChecked.push(item);
                }else{
                  editFormUsersUnchecked.push(item);
                }
              });
              _this.editForm.users = editFormUsersUnchecked.concat(editFormUsersChecked);
            },
            //显示新增界面
            handleAdd:function(){
                let _this = this;
                if (_this.$refs.editForm) {
                    _this.$refs.editForm.resetFields(); //重置表单
                    _this.currentUsers = [];
                }
                //新增时默认把当前任务分配权限给管理员
                _this.users.forEach(function(item){
                  if(item.role==='admin'){
                    _this.currentUsers.push(item.id);
                  }
                });
                _this.reSortUsers(); //重排所有用户权限，选中的在最后面
                this.editFormVisible = true;
                this.editFormTtile = '新增任务';
                this.editForm.id = '';
                this.editForm.name = '';
                this.editForm.remark = '';
                this.editForm.appId = '';
                this.editForm.branchType = '';
                this.editForm.command = '';
                this.editForm.ftpId = '';
                this.editForm.isCombinePackage = false;
                this.editForm.backEndPackagePath = '';
                this.editForm.isPublish = false;
                this.editForm.jenkinsPath = '';
                this.editForm.jenkinsName = '';
                this.editForm.jenkinsUsername = '';
                this.editForm.jenkinsPassword = '';
                this.editForm.jobFirstParamKey = '';
                this.editForm.jobFirstParamValue = '';
                this.editForm.jobSecondParamKey = '';
                this.editForm.jobSecondParamValue = '';
                this.editForm.jobThirdParamKey = '';
                this.editForm.jobThirdParamValue = '';
            },
            //获取用户列表
            getTaskList : function(){
              let _this = this;
              let params = {
                  limit : _this.currentPageSize,
                  page : _this.currentPage
              };
              if(_this.searchForm.taskSearchKey && _this.searchForm.taskSearchKey!=''){
                  params.searchKey = _this.searchForm.taskSearchKey;
              }
              
              _this.listLoading = true;
              axios.get('/api/task/getTaskListByCriteria',{params:params}).then(function(res){
                _this.listLoading = false;
                if(res.data.success){
                  _this.tableData = res.data.data;
                  _this.tableDataLength = res.data.meta.count; 
                }else{
                  _this.$message({
                      message:res.data.msg,
                      type: 'error'
                  });
                  _this.tableData = [];
                  _this.tableDataLength = 0;
                }
              });
            },
            //从app表里获取所有应用
            getAppList:function(){
              let _this = this;
              axios.get('/api/app/getAppListByCriteria').then(function(res){ 
                if(res.data.success){
                  res.data.data.forEach(function(item,i){
                    _this.editForm.appList.push({"name":item.name,"id":item._id});
                  });
                }else{
                  _this.$message({
                      message:res.data.msg,
                      type: 'error'
                  });
                }
              });
            },
            //从ftp表里获取所有ftp
            getFtpList:function(){
              let _this = this;
              axios.get('/api/ftp/getFtpListByCriteria').then(function(res){ 
                if(res.data.success){
                  res.data.data.forEach(function(item,i){
                    _this.editForm.ftp.push({"name":item.name,"id":item._id});
                  });
                }else{
                  _this.$message({
                      message:res.data.msg,
                      type: 'error'
                  });
                }
              });
            },
            //从user表里获取所有用户
            getUserList:function(){
              let _this = this;
              axios.get('/api/user/getAllUserList').then(function(res){ 
                if(res.data.success){
                  res.data.data.forEach(function(item){
                    _this.editForm.users.push({name:item.username,id:item._id,role:item.role});
                    _this.users.push({name:item.username,id:item._id,role:item.role});
                  });
                }else{
                  _this.$message({
                      message:res.data.msg,
                      type: 'error'
                  });
                }
              });
            },
            handleSizeChange(val) {
                this.currentPageSize = val;
                this.getTaskList();
            },
            handleCurrentChange(val) {
                this.currentPage = val;
                this.getTaskList();
            }
        }
    };
</script>

<style lang="scss" scoped>
  .toolbar .el-form-item {
    margin-bottom: 10px;
  }
  .toolbar {
    background: #fff;
        padding-top:10px;
  }
  
  .el-select{
    width:90%;
  }
  .el-dialog .el-input{
    width:90%;
  }
</style>
