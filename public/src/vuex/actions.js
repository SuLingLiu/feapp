//删除任务构建条目
export const deleteTaskBuildItem = ({commit}, timestamp) => {
    commit('DELETE_TASK_BUILD_ITEM', {timestamp});
};

//添加任务构建条目
export const addTaskBuildItem = ({commit}, taskBuildInfo) => {
    commit('ADD_TASK_BUILD_ITEM', taskBuildInfo);
};

//显示构建列表
export const showAsideBuildList = ({commit}) => {
    commit('SHOW_ASIDE_BUILD_LIST');
};