<template>
	<section>
		<!--工具条-->
		<el-col :span="24" class="toolbar">
			<el-form :inline="true" :model="formInline" class="demo-form-inline">
				<el-form-item label="任务名称">
					<el-input v-model="searchForm.taskSearchKey" @keyup.enter.native="search" placeholder="请输入任务名称"></el-input>
				</el-form-item>
                <el-form-item>
                  <el-input v-show="false"></el-input>
                </el-form-item>
				<el-form-item>
					<el-button type="primary" icon="search" @click="search">查询</el-button>
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
                <el-table-column prop="isCombinePackage" label="合包(是/否)" :formatter="formatterCombine">
                </el-table-column>
                <el-table-column prop="isPublish" label="发版(是/否)" :formatter="formatterPublish">
                </el-table-column>
                <el-table-column prop="remark" label="备注">
                </el-table-column>
				<el-table-column label="操作" width="100">
					<template scope="scope">
                        <el-button type="text" size="small" @click="showBuild(scope.row)">构建</el-button>
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
            :page-sizes="[ 20, 40, 100]"
            :page-size="currentPageSize"
            layout="total, sizes, prev, pager, next, jumper"
			:total="tableDataLength"
            style="float:right">
			</el-pagination>
		</el-col>

        <el-dialog :title="buildTaskTitle" v-model="editFormVisible" :close-on-click-modal="false">
        <el-form :model="editForm" label-width="120px" :rules="editFormRules" ref="editForm">
            <el-form-item label="项目目录" prop="projectName">

                <el-select v-show="buildTaskTitle.indexOf('PRD')!=-1" disabled id="projectName" v-model="editForm.projectName" prop="editForm.projectName" placeholder="请选择目录">
                    <el-option v-for="item in project" :label="item" :value="item"></el-option>
                </el-select>

                <el-select v-show="buildTaskTitle.indexOf('PRD')==-1" id="projectName" v-model="editForm.projectName" prop="editForm.projectName" placeholder="请选择目录" @change="getTagVersions">
                    <el-option v-for="item in project" :label="item" :value="item"></el-option>
                </el-select>

            </el-form-item>
            <div v-show="buildTaskTitle.indexOf('PRD')==-1" >
                <el-form-item prop="tagVersion" label="请选择tag" v-show="editForm.branchType=='tag'&&editForm.projectName!=='all project'">
                    <el-select v-model="editForm.tagVersion" prop="editForm.tagVersion" placeholder="请选择tag版本">
                        <el-option v-for="tag in tagVersionList" :label="tag" :value="tag"></el-option>
                    </el-select>
                </el-form-item>
            </div>
            <el-form-item label="后端版本号" prop="backEndVersion" v-show="editForm.isCombinePackage==true">
                <el-input v-model="editForm.backEndVersion"></el-input>
            </el-form-item>
            <el-form-item>
                <el-button type="primary" :disabled="isDisabled" @click="handleBuild" style="padding:10px 40px;">构建</el-button>
            </el-form-item>
            
        </el-form>
        </el-dialog>
	</section>
</template>


<script>
    import axios from 'axios';
    import moment from 'moment';
    import {mapActions} from 'vuex';
    export default {
        data() {
            let projectNameValidate = (rule, value, callback) => {
              let _this = this;
                if (value === '' && _this.editForm.branchType!='tag') {
                    callback(new Error('请选择项目目录!'));
                } else {
                    callback();
                }
            };
            let tagValidate = (rule, value, callback) => {
              let _this = this;
                if (value === '' && (_this.editForm.branchType=='tag'&&_this.editForm.projectName!=='all project')) {
                    callback(new Error('请选择tag版本!'));
                } else {
                    callback();
                }
            };
            let backEndVersionValidate = (rule, value, callback) => {
              let _this = this;
                if (value === '' && _this.editForm.isCombinePackage==true) {
                    callback(new Error('请输入后端版本号!'));
                } else {
                    callback();
                }
            };
            return {
                buildResult:'',
                formInline: {
                    user: ''
                },
                isLoading:false,
                editFormVisible:false,//构建界面显是否显示
                buildTaskTitle:'',//构建界面标题
                project:[],//项目目录
                tagVersionList:[],//当前项目的tag版本
                isDisabled:false,
                //编辑界面数据
                editForm: {
                    _id:0,
                    name: '',
                    appName:'',
                    projectName:'',
                    tagVersion:'',
                    backEndVersion:'',
                    isCombinePackage:false,
                    branchType:'',
                    endVersion:'',
                    appId:'',
                    taskId:'',
                    taskCommand:''
                },
                //查询
                searchForm:{
                    taskSearchKey:'',
                },
                editFormRules:{
                    projectName:[{required: false,validator: projectNameValidate}],
                    tagVersion:[{required:false,validator:tagValidate}],
                    backEndVersion:[{required:false,validator:backEndVersionValidate}]
                },
                btnEditText:'提 交',
                tableData:[],
                tableDataLength : 0,
                listLoading:false,
                currentPage:1,
                currentPageSize:20
            };
        },
        created:function(){
            this.getTaskList();
        },
        methods: {

            //查询
            search:function(){
                this.getTaskList();
            },
            //格式化布尔值(是/否)
            formatterCombine: function(row){
              return row.isCombinePackage===true ? '是' : '否';
            },
            //格式化是否发包
            formatterPublish: function(row){
              return row.isPublish===true ? '是' : '否';
            },
            //如果当前任务为tag的任务时，获取项目下所有的tag版本
            getTagVersions:function(){
                let _this = this;
                let branchType = _this.editForm.branchType;
                if(branchType==='tag' && _this.editForm.projectName!=='all project'){
                    let taskId = _this.editForm.taskId;
                    let projectName = _this.editForm.projectName;
                    axios.get('/api/task/getTagVersion',{params:{taskId:taskId,projectName:projectName}}).then(function(res){
                        if(res.data.success){
                            _this.tagVersionList = res.data.data;
                        }else{
                            _this.$message({
                                message:res.data.msg,
                                type: 'error'
                            });
                        }
                    });
                }
            },
            //初始化构建任务
            showBuild:function(row){
                const _this = this;
                //显示构建弹窗
                _this.editFormVisible = true;
                _this.buildTaskTitle = '构建任务：'+row.name;
                _this.editForm.branchType = row.branchType;
                _this.editForm.projectName = '';
                _this.editForm.name = row.name;
                _this.editForm.appName = row.app.name;
                _this.editForm.isCombinePackage = row.isCombinePackage;
                _this.editForm.isPublish = row.isPublish;
                _this.editForm.appId = row.app._id;
                _this.editForm.taskId = row._id;
                _this.editForm.command = row.command;
                _this.isLoading = false;
                if (_this.$refs.editForm) {
                    _this.$refs.editForm.resetFields(); //重置表单
                }
                _this.buildResult = '';
                //获取后端版本号
                _this.editForm.backEndVersion = localStorage.getItem(row._id);
                //获取当前任务的所有项目
                _this.project = [];
                axios.get('/api/task/getProject',{params:{taskId:row._id,path:row.app.name}}).then(function(res){
                    if(res.data.success){
                        _this.project = res.data.data;
                        _this.project.push('all project');

                        _this.editForm.projectName = _this.editForm.branchType =='tag' ? 'all project' :'';
                    }else{
                        _this.$message({
                            message:res.data.msg,
                            type: 'error'
                        });
                    }
                });
            },
            //后端版本号存入localstorage中
            setLocalStorage:function(taskId,backEndVersion){
                localStorage.setItem(taskId,backEndVersion);
            },
            //构建任务
            handleBuild:function(){
                const _this = this;
                _this.$refs.editForm.validate((valid)=>{
                    if(valid){
                        //隐藏弹框start
                        _this.editFormVisible = false;

                        setTimeout(function(){
                            _this.showAsideBuildList();
                        },400);
                        //隐藏弹框end
                        _this.setLocalStorage(_this.editForm.taskId,_this.editForm.backEndVersion);
                        _this.isLoading = true;
                        _this.buildResult = '';
                        
                        let params = {
                            taskId: _this.editForm.taskId,
                            tagVersion:_this.editForm.tagVersion,
                            projectName: _this.editForm.projectName,
                            backEndVersion: _this.editForm.backEndVersion!='null' ? _this.editForm.backEndVersion : '',
                            createdBy: '',
                            buildStatus:''
                        };

                        //右侧任务构建历
                        let storeObj = {};
                        let time = new Date();
                        let storeObjId = _this.editForm.name+time.getTime();
                        storeObj[storeObjId] = {};
                        storeObj[storeObjId].id = storeObjId;
                        storeObj[storeObjId].name = _this.editForm.name + ' '+_this.editForm.projectName;
                        storeObj[storeObjId].isLoading = true;
                        _this.addTaskBuildItem(storeObj[storeObjId]);
                        params.taskBuildHistoryId = storeObjId;
                        axios.post('/api/task/goBuild/',params).then(function(res){//打包
                            if(res.data.info.success){
                                _this.buildResult = _this.getTime()+res.data.info.msg;
                                storeObj[params.taskBuildHistoryId].package = _this.getTime()+res.data.info.msg;
                                _this.addTaskBuildItem( storeObj[params.taskBuildHistoryId] );
                                if(res.data.isCombine){
                                    let combineParams = res.data.params;
                                    combineParams.revision = res.data.revision;
                                    combineParams.id = res.data.id;
                                    combineParams.taskBuildHistoryId = params.taskBuildHistoryId;
                                    axios.post('/api/task/combinePackager',combineParams).then(function(res){
                                            if(res.data.info.success){
                                                storeObj[combineParams.taskBuildHistoryId].combine = _this.getTime()+res.data.info.msg;
                                                
                                                _this.addTaskBuildItem(storeObj[combineParams.taskBuildHistoryId]);
                                                if(res.data.isPublish){
                                                    let publishParams = res.data.params;
                                                    publishParams.taskBuildHistoryId = combineParams.taskBuildHistoryId;
                                                    publishParams.revision = res.data.revision;
                                                    publishParams.id = res.data.params.id;
                                                    axios.post('/api/task/publishPackager',publishParams).then(function(res){
                                                        if(res.data.info.success){
                                                            _this.isLoading = false;
                                                            storeObj[publishParams.taskBuildHistoryId].publish = _this.getTime()+res.data.info.msg;
                                                            
                                                            _this.addTaskBuildItem( storeObj[publishParams.taskBuildHistoryId] );
                                                            storeObj[publishParams.taskBuildHistoryId].isLoading = false;
                                                        }else{
                                                            _this.isLoading = false;
                                                            storeObj[publishParams.taskBuildHistoryId].publish = _this.getTime()+res.data.info.msg;

                                                            _this.addTaskBuildItem( storeObj[publishParams.taskBuildHistoryId] );

                                                            storeObj[publishParams.taskBuildHistoryId].isLoading = false;
                                                        }
                                                    });
                                                }else{
                                                    _this.isLoading = false;
                                                    storeObj[combineParams.taskBuildHistoryId].isLoading = false;
                                                }
                                            }else{
                                                _this.isLoading = false;
                                                storeObj[combineParams.taskBuildHistoryId].combine = _this.getTime()+res.data.info.msg;
                                                
                                                _this.addTaskBuildItem( storeObj[combineParams.taskBuildHistoryId] );
                                                storeObj[combineParams.taskBuildHistoryId].isLoading = false;
                                            }
                                        });
                                }else{
                                    let combineParams = res.data.params;
                                    combineParams.revision = res.data.revision;
                                    combineParams.id = res.data.id;
                                    combineParams.taskBuildHistoryId = params.taskBuildHistoryId;

                                    if(res.data.isPublish){
                                        let publishParams = res.data.params;
                                        publishParams.taskBuildHistoryId = combineParams.taskBuildHistoryId;
                                        publishParams.revision = res.data.revision;
                                        publishParams.id = res.data.id;
                                        axios.post('/api/task/publishPackager',publishParams).then(function(res){
                                            if(res.data.info.success){
                                                _this.isLoading = false;
                                                storeObj[publishParams.taskBuildHistoryId].publish = _this.getTime()+res.data.info.msg;
                                                
                                                _this.addTaskBuildItem( storeObj[publishParams.taskBuildHistoryId] );
                                                storeObj[publishParams.taskBuildHistoryId].isLoading = false;
                                            }else{
                                                _this.isLoading = false;
                                                storeObj[publishParams.taskBuildHistoryId].publish = _this.getTime()+res.data.info.msg;

                                                storeObj[publishParams.taskBuildHistoryId].isLoading = false;
                                            }
                                        });
                                    }else{
                                        _this.isLoading = false;
                                        storeObj[combineParams.taskBuildHistoryId].isLoading = false;
                                    }

                                }
                                
                            }else{
                                _this.isLoading = false;
                                storeObj[params.taskBuildHistoryId].package = _this.getTime()+res.data.info.msg;
                                
                                _this.addTaskBuildItem( storeObj[params.taskBuildHistoryId] );
                                storeObj[params.taskBuildHistoryId].isLoading = false;
                            }
                        });
                    }
                });
                
            },
            getTime:function(){
                let date = new Date();
                let month = date.getMonth()+1;
                let day = date.getDate();
                let hours = date.getHours();
                let minutes = date.getMinutes();
                month<10 ? month='0'+month : month=month;
                day<10 ? day='0'+day : day=day;
                hours<10 ? hours='0'+hours : hours=hours;
                minutes<10 ? minutes='0'+minutes : minutes=minutes;
                let dateStr = '<span style="font-size:80%;color:red;">[ '+date.getFullYear()+month+day+' '+hours+':'+minutes+' ]</span> '
                return dateStr;
            },
            //获取用户列表
            getTaskList : function(){
                const _this = this;
                const params = {
                    limit : _this.currentPageSize,
                    page : _this.currentPage
                };
                if(_this.searchForm.taskSearchKey && _this.searchForm.taskSearchKey!=''){
                    params.searchKey = _this.searchForm.taskSearchKey;
                }
                
                axios.get('/api/task/getTaskListByCriteria',{params:params}).then(function(res){
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
            handleSizeChange(val) {
                this.currentPageSize = val;
                this.getTaskList();
            },
            handleCurrentChange(val) {
                this.currentPage = val;
                this.getTaskList();
            },
            ...mapActions([
                'showAsideBuildList',
                'addTaskBuildItem'
            ])
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
    .el-dialog .el-input,.el-dialog .el-select{
        width:40%;
    }
</style>
