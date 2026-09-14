import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EMPTY_STORE = () => ({ version: 1, works: [], friendRequests: [], friendships: [] });

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.readOnly = false;
    this.loadError = null;
    this.data = EMPTY_STORE();
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.works)) {
        throw new Error('社区数据格式不受支持');
      }
      parsed.friendRequests = Array.isArray(parsed.friendRequests) ? parsed.friendRequests : [];
      parsed.friendships = Array.isArray(parsed.friendships) ? parsed.friendships : [];
      this.data = parsed;
    } catch (error) {
      this.readOnly = true;
      this.loadError = error;
      console.error(`[community-store] 数据损坏，已停止写入：${error.message}`);
    }
  }

  read(reader) {
    return reader(this.data);
  }

  update(mutator) {
    if (this.readOnly) {
      const error = new Error('社区数据需要管理员修复，当前禁止写入');
      error.status = 503;
      throw error;
    }
    const next = structuredClone(this.data);
    const result = mutator(next);
    this.persist(next);
    this.data = next;
    return result;
  }

  persist(data) {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      fs.renameSync(tempPath, this.filePath);
    } catch (error) {
      this.readOnly = true;
      try { fs.unlinkSync(tempPath); } catch { /* 临时文件可能尚未创建 */ }
      throw error;
    }
  }
}

export function createJsonStore(filePath) {
  return new JsonStore(filePath);
}
