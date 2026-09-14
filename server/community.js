import crypto from 'node:crypto';
import express from 'express';

const MAX_TRAY_ITEMS = 100;
const MAX_SUMMARY_LENGTH = 4000;
const MAX_COMMENT_LENGTH = 300;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeTray(input) {
  if (!Array.isArray(input) || input.length > MAX_TRAY_ITEMS) {
    throw httpError(400, `沙盘必须包含 1—${MAX_TRAY_ITEMS} 件沙具`);
  }
  const tray = input.map(item => {
    const x = Number(item?.x);
    const y = Number(item?.y);
    if (!item || typeof item.toyId !== 'string' || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw httpError(400, '沙盘中包含无效沙具');
    }
    return {
      toyId: item.toyId.slice(0, 80),
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y)),
      rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) % 360 : 0,
      scale: Number.isFinite(Number(item.scale)) ? Math.min(2, Math.max(0.5, Number(item.scale))) : 1,
    };
  });
  if (!tray.length) throw httpError(400, '不能发布空沙盘');
  return tray;
}

function canView(work, viewerId) {
  if (work.ownerId === viewerId) return true;
  // 好友关系尚未接入前，“仅好友”严格按“仅自己”处理，避免隐私越权。
  return work.visibility === 'public';
}

function present(work, viewerId, { detail = false } = {}) {
  const mine = Boolean(viewerId && work.ownerId === viewerId);
  const author = work.anonymous && !mine
    ? { nick: '一位旅人', avatar: null }
    : { nick: work.authorNick, avatar: work.authorAvatar || null };
  const result = {
    id: work.id,
    title: work.title,
    author,
    anonymous: work.anonymous,
    visibility: work.visibility,
    createdAt: work.createdAt,
    summary: work.summary,
    tray: work.tray,
    mine,
    likes: work.likedBy.length,
    collects: work.collectedBy.length,
    liked: Boolean(viewerId && work.likedBy.includes(viewerId)),
    collected: Boolean(viewerId && work.collectedBy.includes(viewerId)),
    commentCount: work.comments.length,
  };
  if (detail) {
    result.comments = work.comments.map(comment => ({
      id: comment.id,
      author: comment.authorNick,
      text: comment.text,
      createdAt: comment.createdAt,
      mine: Boolean(viewerId && comment.ownerId === viewerId),
    }));
  }
  return result;
}

export class CommunityService {
  constructor(store) {
    this.store = store;
  }

  createWork(user, input) {
    if (!user?.id) throw httpError(401, '请先登录知乎');
    const title = cleanText(input?.title, 48);
    const summary = cleanText(input?.summary, MAX_SUMMARY_LENGTH);
    if (!title) throw httpError(400, '请给沙盘起一个名字');
    if (!summary) throw httpError(400, '沙盘报告摘要不能为空');
    const visibility = ['public', 'friends', 'private'].includes(input?.visibility)
      ? input.visibility
      : 'public';
    const work = {
      id: crypto.randomUUID(),
      ownerId: user.id,
      authorNick: cleanText(user.nick, 80) || '知乎用户',
      authorAvatar: cleanText(user.avatar, 1000) || null,
      anonymous: Boolean(input?.anonymous),
      visibility,
      createdAt: Date.now(),
      title,
      summary,
      tray: normalizeTray(input?.tray),
      likedBy: [],
      collectedBy: [],
      comments: [],
    };
    this.store.update(data => data.works.push(work));
    return present(work, user.id, { detail: true });
  }

  listWorks(viewerId, { filter = 'all', cursor = '', limit = 10 } = {}) {
    const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 20);
    return this.store.read(data => {
      let works = [...data.works]
        .filter(work => canView(work, viewerId))
        .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
      if (filter === 'mine') works = viewerId ? works.filter(work => work.ownerId === viewerId) : [];
      if (filter === 'collected') works = viewerId ? works.filter(work => work.collectedBy.includes(viewerId)) : [];
      const start = cursor ? Math.max(works.findIndex(work => work.id === cursor) + 1, 0) : 0;
      const page = works.slice(start, start + pageSize);
      return {
        items: page.map(work => present(work, viewerId)),
        nextCursor: start + page.length < works.length ? page.at(-1)?.id || null : null,
      };
    });
  }

  getWork(id, viewerId) {
    return this.store.read(data => {
      const work = data.works.find(item => item.id === id);
      if (!work || !canView(work, viewerId)) throw httpError(404, '没有找到这个沙盘');
      return present(work, viewerId, { detail: true });
    });
  }

  toggleReaction(id, viewerId, field) {
    if (!viewerId) throw httpError(401, '请先登录知乎');
    return this.store.update(data => {
      const work = data.works.find(item => item.id === id);
      if (!work || !canView(work, viewerId)) throw httpError(404, '没有找到这个沙盘');
      const list = work[field];
      const index = list.indexOf(viewerId);
      if (index >= 0) list.splice(index, 1);
      else list.push(viewerId);
      return present(work, viewerId, { detail: true });
    });
  }

  addComment(id, user, rawText) {
    if (!user?.id) throw httpError(401, '请先登录知乎');
    const text = cleanText(rawText, MAX_COMMENT_LENGTH);
    if (!text) throw httpError(400, '评论不能为空');
    return this.store.update(data => {
      const work = data.works.find(item => item.id === id);
      if (!work || !canView(work, user.id)) throw httpError(404, '没有找到这个沙盘');
      work.comments.push({
        id: crypto.randomUUID(),
        ownerId: user.id,
        authorNick: cleanText(user.nick, 80) || '知乎用户',
        text,
        createdAt: Date.now(),
      });
      return present(work, user.id, { detail: true });
    });
  }
}

export function createCommunityRouter({ service, getUser }) {
  const router = express.Router();
  const handle = action => (req, res) => {
    try { action(req, res); }
    catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : '社区服务暂时不可用' }); }
  };

  router.get('/', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.listWorks(user?.id, req.query));
  }));
  router.post('/', handle((req, res) => {
    const user = getUser(req, res);
    res.status(201).json(service.createWork(user, req.body));
  }));
  router.get('/:id', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.getWork(req.params.id, user?.id));
  }));
  router.post('/:id/like', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.toggleReaction(req.params.id, user?.id, 'likedBy'));
  }));
  router.post('/:id/collect', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.toggleReaction(req.params.id, user?.id, 'collectedBy'));
  }));
  router.post('/:id/comments', handle((req, res) => {
    const user = getUser(req, res);
    res.status(201).json(service.addComment(req.params.id, user, req.body?.text));
  }));
  return router;
}
