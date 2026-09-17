// Extra card metadata kept separate from the source card transcripts.
const cardRange = (start, end, label) => Object.fromEntries(Array.from({ length: end - start + 1 }, (_, index) => [start + index, label]));
const cardCategoryMap = (groups) => groups.reduce((map, [label, numbers]) => {
  numbers.forEach((number) => { map[number] = label; });
  return map;
}, {});

window.SUSAN_CARD_CATEGORIES = {
  noun: {
    ...cardRange(1, 22, "动物"),
    ...cardRange(23, 29, "水果"),
    ...cardRange(30, 34, "蔬菜"),
    ...cardRange(35, 40, "食物"),
    ...cardRange(41, 48, "人物"),
    ...cardRange(49, 54, "身体"),
    ...cardRange(55, 64, "家居"),
    ...cardRange(65, 69, "学习"),
    ...cardRange(70, 74, "日用品"),
    ...cardRange(75, 84, "衣物"),
    ...cardRange(85, 86, "配件"),
    ...cardRange(87, 91, "交通"),
    ...cardRange(92, 100, "自然"),
  },
  verb: cardCategoryMap([
    ["动物行为", [2, 3, 4, 9, 10, 11, 13, 18, 19, 20, 22, 27, 28, 29, 33, 35, 38, 41, 45, 59, 68, 77, 93]],
    ["日常动作", [5, 6, 7, 8, 12, 15, 16, 17, 21, 23, 24, 26, 31, 34, 37, 39, 40, 43, 47, 48, 52, 54, 55, 58, 61, 62, 63, 64, 65, 67, 69, 71, 72, 75, 76, 78, 81, 82, 83, 85, 86, 87, 89, 96, 97, 98, 99, 100]],
    ["沟通观察", [14, 25, 30, 32, 46, 49, 50, 51, 53, 60, 70, 73, 74, 79, 84, 90, 91, 92, 95]],
    ["情绪关系", [1, 36, 42, 44, 56, 57, 66, 88]],
  ]),
  adjective: cardCategoryMap([
    ["尺寸外观", [4, 5, 6, 7, 8, 9, 28, 29, 32, 33, 40, 41]],
    ["性格品质", [2, 3, 10, 11, 14, 15, 16, 17, 22, 23, 38, 39, 43, 44, 45, 47]],
    ["感受情绪", [12, 13, 18, 19, 34, 35, 36, 37, 42, 46, 48, 49, 68, 69, 72, 73, 76, 77]],
    ["状态属性", [1, 20, 21, 24, 25, 26, 27, 30, 31, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 70, 71, 74, 75, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100]],
  ]),
};

window.SUSAN_CARD_ZOOM = {
  annoy: {
    title: "🔍 Zoom in — 一起玩",
    intro: "用「音效·表情·动作·变大变小·变换角色·变颜色·反常识」把这一张词汇活，钻进它的小世界聊天。练习顺序：每句话先加一个音效，稳定了加表情，再加动作，一步步叠加刻意练习。记得多提问、留气口，让宝宝多说，而不是自己一直讲。",
    rows: [
      { zh: "音效", en: "Sound", textZh: "「惹恼」重重落地「咚」，像大象踩脚~", textEn: "The annoy lands boom, like an elephant!" },
      { zh: "表情", en: "Face", textZh: "「惹恼」做搞怪表情，把自己都逗笑了~", textEn: "Silly face while annoying, laugh at yourself!" },
      { zh: "动作", en: "Action", textZh: "「惹恼」时踩着想象的积木，一步一晃~", textEn: "Step on pretend blocks as you annoy!" },
      { zh: "变大变小", en: "Big & Small", textZh: "缩成小蚂蚁「惹恼」，钻过门缝~", textEn: "Tiny ant annoying, through the crack!" },
      { zh: "变换角色", en: "New Character", textZh: "小猫来「惹恼」了，喵喵伴奏~", textEn: "A kitten comes to annoy, meow!" },
      { zh: "变颜色", en: "Color", textZh: "「惹恼」染成彩虹色，七彩的~", textEn: "Rainbow annoy, seven colors!" },
      { zh: "反常识", en: "Something Silly", textZh: "「惹恼」转呀转转到晕，倒下~", textEn: "Spin annoying till dizzy, fall!" },
    ],
  },
};
