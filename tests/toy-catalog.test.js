import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(repo, 'public', 'app.js'), 'utf8');
const communitySource = fs.readFileSync(path.join(repo, 'server', 'community.js'), 'utf8');
const categoryLiteral = source.match(/const CATEGORIES = (\[[\s\S]*?\n\]);/)?.[1];
const imageLiteral = source.match(/const TOY_IMAGES=(\{[\s\S]*?\n\});/)?.[1];
assert.ok(categoryLiteral, 'CATEGORIES catalog should be readable');
assert.ok(imageLiteral, 'TOY_IMAGES map should be readable');

const categories = vm.runInNewContext(`(${categoryLiteral})`);
const imageMap = vm.runInNewContext(`(${imageLiteral})`);
const serverCategoryLiteral = communitySource.match(/const CATEGORY_TOYS = Object\.freeze\((\{[\s\S]*?\n\})\);/)?.[1];
assert.ok(serverCategoryLiteral, 'server CATEGORY_TOYS catalog should be readable');
const serverCategories = vm.runInNewContext(`(${serverCategoryLiteral})`);

const requiredNames = [
  '攀登者', '携手一家三口', '半脸面具人', '背靠背双子', '融化陶土人',
  '展翅雄鹰', '哺乳母鹿', '昂首雄狮', '笼中金丝雀', '吞尾之蛇',
  '稳固石桥', '半开柴门', '敞开帐篷', '废弃游乐园', '无门孤岛灯塔',
  '枯木新芽', '微光绿洲', '肥沃黑土', '枯萎玫瑰', '狂风骤雨',
  '升空热气球', '展翅滑翔翼', '断桨孤舟', '无带坦克', '抛锚潜水艇', '超载皮卡', '断桥前的公交',
  '悬浮金羽', '平衡天平', '饱满麦穗', '开启的宝箱', '燃烧冰块', '碎裂沙漏', '生锈铁锚', '乱麻红线', '上锁黑盲盒', '蒙尘王冠',
  '生翼之书', '水中月镜', '发条齿轮龙', '沉睡石像鬼', '破损水晶鞋', '迷雾海市蜃楼',
  '守护石狮', '破障巨斧', '斩棘宝剑', '治愈法杖', '内刺匕首', '笑脸多眼蜘蛛', '吞光黑泥', '荆棘锁链',
];

test('every sandtoy category exposes all twelve prepared toys', () => {
  assert.equal(categories.length, 8);
  for (const category of categories) {
    assert.equal(category.toys.length, 12, `${category.name} should contain 12 toys`);
  }
  const names = new Set(categories.flatMap(category => category.toys.map(toy => toy.name)));
  for (const name of requiredNames) assert.ok(names.has(name), `missing sandtoy: ${name}`);
});

test('every catalog toy has one real web asset and every prepared asset is used', () => {
  const toys = categories.flatMap(category => category.toys);
  const ids = toys.map(toy => toy.id);
  assert.equal(new Set(ids).size, ids.length, 'sandtoy ids must be unique');
  assert.deepEqual(new Set(Object.keys(imageMap)), new Set(ids));

  const mapped = Object.values(imageMap);
  assert.equal(new Set(mapped).size, mapped.length, 'each sandtoy should use a distinct image');
  for (const url of mapped) {
    assert.match(url, /^\/images\/.+\.webp$/);
    assert.ok(fs.existsSync(path.join(repo, 'public', url)), `missing asset: ${url}`);
  }

  const assetDirs = ['human', 'animals', 'buildings', 'nature', 'transport', 'Symbol', 'fantasy', 'attackandmonster'];
  const prepared = assetDirs.flatMap(dir => fs.readdirSync(path.join(repo, 'public', 'images', dir))
    .filter(file => file.endsWith('.webp'))
    .map(file => `/images/${dir}/${file}`));
  assert.deepEqual(new Set(mapped), new Set(prepared));
});

test('community matching knows the category of every browser sandtoy', () => {
  for (const category of categories) {
    const known = new Set(serverCategories[category.id]);
    for (const toy of category.toys) assert.ok(known.has(toy.id), `${category.name}: ${toy.id}`);
  }
});
