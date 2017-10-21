import Vue from 'vue';
import Vuex from 'vuex';
import * as actions from './actions';
import * as getters from './getters';

Vue.use(Vuex);

// 应用初始状态
const state = {
    taskBuildHistory: [],
    showAsideBuildList: false
};

// 定义所需的 mutations
const mutations = {
    GET_TASK_BUILD_HISTORY(state, {taskBuildHistory}) {
        state.taskBuildHistory = taskBuildHistory;
    },
    ADD_TASK_BUILD_ITEM(state, taskBuildItem) {
        let exsit = false;
        state.taskBuildHistory.forEach(function(item,i){
            if(item.id===taskBuildItem.id){
                state.taskBuildHistory.splice(i,1,taskBuildItem);
                exsit = true;
                return;
            }
        });
        if(!exsit){
            state.taskBuildHistory.unshift(taskBuildItem);
        }
    },
    DELETE_TASK_BUILD_ITEM(state, timestamp) {
        state.taskBuildHistory.forEach(function(item,i){
            if(item.id===timestamp.timestamp){
                state.taskBuildHistory.splice(i,1);
                return;
            }
        })
    },
    SHOW_ASIDE_BUILD_LIST(state) {
        if(!state.showAsideBuildList){
            state.showAsideBuildList = true;
        }
    }
};

// 创建 store 实例
export default new Vuex.Store({
    actions,
    getters,
    state,
    mutations
});
