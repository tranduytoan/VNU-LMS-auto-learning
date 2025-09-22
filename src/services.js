import { LmsApi } from "./api.js";

function getAllLeafsFromContentArray(contentArray) {
    if (!contentArray || contentArray.length === 0) return [];

    const allLeafs = [];
    contentArray.forEach(content => {
        if (content.isFolder) {
            allLeafs.push(...getAllLeafsFromContentArray(content.childrens));
        } else {
            allLeafs.push(content);
        }
    });
    return allLeafs;
}

function filterNowAvailableLeafs(leafs, finishedLeafs) {
    if (!leafs || leafs.length === 0) return [];

    return leafs.filter(leaf => {
        if (finishedLeafs.some(finishedLeaf => finishedLeaf.classContentId === leaf.classContentId)) {
            return false;
        } else if (!leaf.relation) {
            return true;
        } else {
            const relationArray = leaf.relation.split(',').map(r => r.trim()).filter(Boolean);
            return relationArray.every(relation => {
                return finishedLeafs.some(finishedLeaf => finishedLeaf.classContentId === relation);
            });
        }
    });
}

async function addLeafsDetail(leafs, learningLeafs) {
    return Promise.all(leafs.map(async leaf => {
        const learningDetail = learningLeafs.find(l => l.classContentId === leaf.classContentId);
        return {
            ...leaf,
            id: learningDetail ? learningDetail.id : (await services.getLeafId(leaf)),
            isFinish: learningDetail ? learningDetail.isFinish : false,
            isPassed: learningDetail ? learningDetail.isPassed : false,
            learnTime: learningDetail ? learningDetail.learnTime : 0,
            times: learningDetail ? learningDetail.times : 0,
        };
    }));
}

export const services = {
    getCurrentClasses: async () => {
        const currentClassesRaw = (await LmsApi.getListCurrentClasses())?.data?.details;
        return currentClassesRaw.map(({ id, classTitle }) => ({
            id, classTitle
        }));
    },
    
    getAllLeafsOfClass: async (classId) => {
        const rawContentArray = (await LmsApi.getClassContentsGeneral(classId))?.data;
        return getAllLeafsFromContentArray(rawContentArray).map(content => ({
            classContentId: content.id,
            title: content.title,
            classId: content.classId,
            type: content.type,
            mincore: content.mincore,
            fileId: content.fileId,
            isFolder: content.isFolder,
            relation: content.relation,
            childrens: content.childrens
        }));
    },

    getLearningLeafsOfClass: async (classId) => {
        const allLeafsRaw = (await LmsApi.getClassContentsUser(classId))?.data?.lmsClassUserLearning;
        const allLeafs = allLeafsRaw.map(content => ({
            id: content.id,
            title: content.title,
            classContentId: content.classContentId,
            isFinish: content.isFinish,
            isPassed: content.isPassed,
            learnTime: content.learnTime,
            times: content.times,
        }));
        return allLeafs;
    },

    getNowAvailableLeafsOfClass: async (classId) => {
        const allLeafs = await services.getAllLeafsOfClass(classId);
        const learningLeafs = await services.getLearningLeafsOfClass(classId);
        const finishedLeafs = learningLeafs.filter(leaf => leaf.isFinish && leaf.isPassed);
        return await addLeafsDetail(filterNowAvailableLeafs(allLeafs, finishedLeafs), learningLeafs);
    },

    getAllLeafsOfClassWithDetail: async (classId) => {
        const allLeafs = await services.getAllLeafsOfClass(classId);
        const learningLeafs = await services.getLearningLeafsOfClass(classId);
        return await addLeafsDetail(allLeafs, learningLeafs);
    },

    getLeafId: async (leaf) => {
        if (leaf.id) return leaf.id;
        const classUserId = (await LmsApi.getClassContentsUser(leaf.classId))?.data?.id;
        return (await LmsApi.getContentUserCanView(classUserId, leaf.classContentId))?.data?.userLearning?.id;
    }
}