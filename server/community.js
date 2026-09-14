import crypto from 'node:crypto';
import express from 'express';

const MAX_TRAY_ITEMS = 100;
const MAX_SUMMARY_LENGTH = 4000;
const MAX_COMMENT_LENGTH = 300;
const CATEGORY_TOYS = Object.freeze({
  people: ['child', 'student', 'worker', 'doctor', 'police', 'elder', 'mystery'],
  animal: ['cat', 'dog', 'bird', 'fish', 'horse', 'turtle', 'butterfly'],
  building: ['thatch', 'stone', 'cabin', 'flat', 'tower', 'ruin', 'castle'],
  nature: ['tree', 'flower', 'mountain', 'water', 'sun', 'moon', 'rock'],
  traffic: ['bike', 'car', 'train', 'boat', 'plane'],
  symbol: ['key', 'door', 'bridge', 'mirror'],
  fantasy: ['fairy', 'unicorn', 'wizard', 'crystal', 'star', 'rainbow'],
  monster: ['sword', 'shield', 'dragon', 'beast'],
});
const CATEGORY_LABELS = Object.freeze({
  people: '人物类', animal: '动物类', building: '建筑类', nature: '自然类',
  traffic: '交通类', symbol: '象征类', fantasy: '幻想类', monster: '武器 / 怪兽类',
});
const TOY_CATEGORY = new Map(
  Object.entries(CATEGORY_TOYS).flatMap(([category, toys]) => toys.map(toy => [toy, category])),
);

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

function areFriends(data, firstId, secondId) {
  if (!firstId || !secondId) return false;
  return data.friendships.some(pair => pair.includes(firstId) && pair.includes(secondId));
}

function canView(data, work, viewerId) {
  if (work.ownerId === viewerId) return true;
  if (work.visibility === 'friends') return areFriends(data, work.ownerId, viewerId);
  return work.visibility === 'public';
}

function overlap(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  return [...a].filter(value => b.has(value)).length / union.size;
}

function cosine(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let dot = 0, leftSize = 0, rightSize = 0;
  for (const key of keys) {
    const a = left[key] || 0, b = right[key] || 0;
    dot += a * b; leftSize += a * a; rightSize += b * b;
  }
  return leftSize && rightSize ? dot / Math.sqrt(leftSize * rightSize) : 0;
}

function trayProfile(tray) {
  const categories = {};
  const regions = {};
  for (const item of tray) {
    const category = TOY_CATEGORY.get(item.toyId) || 'other';
    categories[category] = (categories[category] || 0) + 1;
    const centered = Math.abs(item.x - 50) <= 20 && Math.abs(item.y - 50) <= 20;
    const region = centered ? 'center' : `${item.x < 50 ? 'left' : 'right'}-${item.y < 50 ? 'top' : 'bottom'}`;
    regions[region] = (regions[region] || 0) + 1;
  }
  return { categories, regions, toys: tray.map(item => item.toyId), size: tray.length };
}

function matchScore(query, work) {
  const left = trayProfile(query.tray);
  const right = trayProfile(work.tray);
  const categoryScore = cosine(left.categories, right.categories);
  const toyScore = overlap(left.toys, right.toys);
  const spatialScore = cosine(left.regions, right.regions);
  const densityScore = 1 - Math.abs(left.size - right.size) / Math.max(left.size, right.size, 1);
  const aspectScore = overlap(query.aspects, work.aspects || []);
  const score = Math.round(100 * (
    categoryScore * 0.45 + toyScore * 0.2 + spatialScore * 0.15
    + densityScore * 0.1 + aspectScore * 0.1
  ));
  const sharedCategories = Object.keys(left.categories)
    .filter(category => right.categories[category] && CATEGORY_LABELS[category])
    .sort((a, b) => Math.min(left.categories[b], right.categories[b]) - Math.min(left.categories[a], right.categories[a]));
  const reasons = [];
  if (sharedCategories.length) reasons.push(`共同使用了${sharedCategories.slice(0, 2).map(id => CATEGORY_LABELS[id]).join('、')}`);
  const sharedToys = new Set(left.toys.filter(toy => right.toys.includes(toy)));
  if (sharedToys.size) reasons.push(`有 ${sharedToys.size} 种相同沙具`);
  if (spatialScore >= 0.72) reasons.push('空间重心与布局节奏相近');
  const sharedAspects = query.aspects.filter(aspect => (work.aspects || []).includes(aspect));
  if (sharedAspects.length) reasons.push('关注的沙盘分析方向相似');
  if (!reasons.length) reasons.push('沙具数量与画面节奏有可比较之处');
  return { score, reasons };
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
      aspects: Array.isArray(input?.aspects)
        ? [...new Set(input.aspects.filter(value => typeof value === 'string'))].slice(0, 4)
        : [],
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
        .filter(work => canView(data, work, viewerId))
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
      if (!work || !canView(data, work, viewerId)) throw httpError(404, '没有找到这个沙盘');
      return present(work, viewerId, { detail: true });
    });
  }

  toggleReaction(id, viewerId, field) {
    if (!viewerId) throw httpError(401, '请先登录知乎');
    return this.store.update(data => {
      const work = data.works.find(item => item.id === id);
      if (!work || !canView(data, work, viewerId)) throw httpError(404, '没有找到这个沙盘');
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
      if (!work || !canView(data, work, user.id)) throw httpError(404, '没有找到这个沙盘');
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

  deleteWork(id, viewerId) {
    if (!viewerId) throw httpError(401, '请先登录知乎');
    return this.store.update(data => {
      const index = data.works.findIndex(item => item.id === id);
      if (index < 0) throw httpError(404, '没有找到这个沙盘');
      if (data.works[index].ownerId !== viewerId) throw httpError(403, '只能删除自己发布的沙盘');
      data.works.splice(index, 1);
      data.friendRequests = data.friendRequests.filter(request => request.workId !== id);
      return { deleted: true, id };
    });
  }

  findMatches(viewerId, input, { limit = 6 } = {}) {
    if (!viewerId) throw httpError(401, '请先登录知乎');
    const query = {
      tray: normalizeTray(input?.tray),
      aspects: Array.isArray(input?.aspects) ? input.aspects.filter(value => typeof value === 'string').slice(0, 4) : [],
    };
    const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 6, 1), 10);
    return this.store.read(data => data.works
      .filter(work => work.visibility === 'public' && work.ownerId !== viewerId)
      .map(work => ({ work: present(work, viewerId), ...matchScore(query, work) }))
      .sort((a, b) => b.score - a.score || b.work.createdAt - a.work.createdAt)
      .slice(0, pageSize));
  }

  sendFriendRequest(workId, user, rawMessage) {
    if (!user?.id) throw httpError(401, '请先登录知乎');
    return this.store.update(data => {
      const work = data.works.find(item => item.id === workId);
      if (!work || work.visibility !== 'public') throw httpError(404, '没有找到这个公开沙盘');
      if (work.ownerId === user.id) throw httpError(400, '不能向自己发送好友申请');
      if (areFriends(data, work.ownerId, user.id)) throw httpError(409, '你们已经是好友了');
      const duplicate = data.friendRequests.find(request =>
        request.fromId === user.id && request.toId === work.ownerId && request.status === 'pending');
      if (duplicate) throw httpError(409, '好友申请已经发送，请等待对方回应');
      const request = {
        id: crypto.randomUUID(),
        workId,
        workTitle: work.title,
        fromId: user.id,
        fromNick: cleanText(user.nick, 80) || '知乎用户',
        fromAvatar: cleanText(user.avatar, 1000) || null,
        fromUrl: cleanText(user.url, 1000) || null,
        toId: work.ownerId,
        toNick: work.authorNick,
        toAvatar: work.authorAvatar || null,
        toAnonymous: work.anonymous,
        message: cleanText(rawMessage, 200) || '我们的沙盘有一些相似之处，想和你认识。',
        status: 'pending',
        createdAt: Date.now(),
        respondedAt: null,
      };
      data.friendRequests.push(request);
      return this.presentFriendRequest(request, user.id);
    });
  }

  presentFriendRequest(request, viewerId) {
    const incoming = request.toId === viewerId;
    const accepted = request.status === 'accepted';
    return {
      id: request.id,
      direction: incoming ? 'incoming' : 'outgoing',
      status: request.status,
      workId: request.workId,
      workTitle: request.workTitle,
      message: request.message,
      createdAt: request.createdAt,
      user: incoming
        ? { nick: request.fromNick, avatar: request.fromAvatar, url: request.fromUrl }
        : {
            nick: request.toAnonymous && !accepted ? '一位旅人' : request.toNick,
            avatar: request.toAnonymous && !accepted ? null : request.toAvatar,
          },
    };
  }

  listFriendRequests(user) {
    if (!user?.id) throw httpError(401, '请先登录知乎');
    return this.store.read(data => {
      const related = data.friendRequests
        .filter(request => request.fromId === user.id || request.toId === user.id)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(request => this.presentFriendRequest(request, user.id));
      return {
        incoming: related.filter(request => request.direction === 'incoming'),
        outgoing: related.filter(request => request.direction === 'outgoing'),
      };
    });
  }

  respondFriendRequest(requestId, user, status) {
    if (!user?.id) throw httpError(401, '请先登录知乎');
    if (!['accepted', 'rejected'].includes(status)) throw httpError(400, '好友申请状态无效');
    return this.store.update(data => {
      const request = data.friendRequests.find(item => item.id === requestId);
      if (!request) throw httpError(404, '没有找到这条好友申请');
      if (request.toId !== user.id) throw httpError(403, '只有接收者可以处理好友申请');
      if (request.status !== 'pending') throw httpError(409, '这条申请已经处理过了');
      request.status = status;
      request.respondedAt = Date.now();
      if (status === 'accepted' && !areFriends(data, request.fromId, request.toId)) {
        data.friendships.push([request.fromId, request.toId].sort());
      }
      return this.presentFriendRequest(request, user.id);
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
  router.post('/matches', handle((req, res) => {
    const user = getUser(req, res);
    res.json({ items: service.findMatches(user?.id, req.body, req.query) });
  }));
  router.get('/friend-requests', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.listFriendRequests(user));
  }));
  router.post('/friend-requests/:requestId/respond', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.respondFriendRequest(req.params.requestId, user, req.body?.status));
  }));
  router.get('/:id', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.getWork(req.params.id, user?.id));
  }));
  router.delete('/:id', handle((req, res) => {
    const user = getUser(req, res);
    res.json(service.deleteWork(req.params.id, user?.id));
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
  router.post('/:id/friend-requests', handle((req, res) => {
    const user = getUser(req, res);
    res.status(201).json(service.sendFriendRequest(req.params.id, user, req.body?.message));
  }));
  return router;
}
