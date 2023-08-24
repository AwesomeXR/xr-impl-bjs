export function makeUniqueKey<K extends string>(key: K, list: any[]) {
  const infoMap = new Map<string, any[]>();

  for (let i = 0; i < list.length; i++) {
    const item = list[i];

    const _info = infoMap.get(item[key]);

    if (_info) _info.push(item);
    else infoMap.set(item[key], [item]);
  }

  for (const [name, items] of infoMap) {
    if (items.length < 2) continue;

    // 从第二项开始重设
    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      item[key] = `${name}.${(i + '').padStart(4, '0')}`;
    }
  }
}
