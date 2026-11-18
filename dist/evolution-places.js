/**
 * A city's broad catalogue date may span a surrender or a change of dynasty.
 * In a documented frame, use the surviving polity and the stage of the event
 * to label the city. Several catalogue entries can describe the same place
 * as both a provincial seat and a capital. Emit one marker for that place.
 */
export function evolutionPlaces(cities, year, frame) {
  let list = cities.filter(city => (city.start ?? -Infinity) <= year && year <= (city.end ?? Infinity));
  if (!frame || year < frame.chapter.startYear || year > frame.chapter.endYear) return list;

  const owners = new Set(frame.features.map(feature => feature.properties.name));
  const seen = new Set(frame.chapter.steps.slice(0, frame.stepIndex + 1).map(step => step.id));
  function place(name, lng, lat, capital, region, description) {
    list = list.filter(city => city.name !== name);
    list.push({
      id: 'evolution-place-' + frame.chapter.id + '-' + name,
      name, lng, lat, kind: capital ? 'capital' : 'city', region, description,
      start: year, end: year, phaseRole: true
    });
  }

  if (frame.chapter.id === 'qin') {
    const cities = [
      ['新郑',113.74,34.40,'韩','xinzheng'],
      ['邯郸',114.48,36.61,'赵','handan'],
      ['蓟',116.36,39.90,'燕','ji'],
      ['大梁',114.30,34.80,'魏','daliang'],
      ['临淄',118.35,36.82,'齐','linzi']
    ];
    for (const [name,lng,lat,owner,fall] of cities) {
      const old = seen.has(fall);
      place(name,lng,lat,!old,old ? '秦' : owner,old ? owner+'国旧都，图上标记原都城所在。' : owner+'国都城。');
    }
  }

  if (frame.chapter.id === 'three-kingdoms') {
    const north = owners.has('晋') ? '晋' : '魏';
    place('洛阳',112.64,34.73,true,north,north === '晋' ? '司马炎受禅后，洛阳为西晋都城。' : '曹魏都城；司马氏执政期间，国号仍为魏。');

    const shu = owners.has('蜀汉');
    place('成都',104.07,30.67,shu,shu ? '蜀汉' : north,shu ? '成都为蜀汉朝廷驻地。' : '蜀汉旧都。刘禅降魏后，成都继续作为益州的政治中心。');

    const wu = owners.has('吴');
    // In 229 and 266 both cities served as capital in succession. Our timeline
    // resolves other events that year; it does not date both capital moves.
    const moving = year === 229 || year === 266;
    const capitalAtWuchang = year < 229 || year === 265;
    const moveNote = year === 229 ? '孙权四月在武昌称帝，九月迁都建业。' : '孙皓此前迁都武昌，266年十二月还都建业（吴纪年）。';
    const wuchang = wu && !moving && capitalAtWuchang;
    const jianye = wu && !moving && !capitalAtWuchang;
    place('武昌',114.89,30.40,wuchang,wu ? '吴' : '晋',moving ? moveNote : wuchang ? '孙吴都城，在今湖北鄂州。' : '长江中游重镇，在今湖北鄂州。');
    place('建业',118.80,32.06,jianye,wu ? '吴' : '晋',moving ? moveNote : jianye ? '吴朝廷此时驻建业。' : wu ? '孙氏经营的江东城市。' : '孙皓在此降晋，建业成为孙吴旧都。');
  }

  if (frame.chapter.id === 'wei-split') {
    const westward = seen.has('chang-an');
    const east = owners.has('东魏');
    place('洛阳',112.64,34.73,!westward,'洛阳盆地',westward ? '孝武帝西行前的北魏旧都。' : '孝文帝迁都后，洛阳为北魏朝廷驻地。');
    place('邺',114.41,36.28,east,east ? '东魏' : '河北',east ? '东魏另立朝廷后迁都邺城。' : '河北重镇，后为东魏都城。');
    if (westward) {
      const west = owners.has('西魏');
      place('长安',108.89,34.27,true,west ? '西魏' : '关中魏廷',west ? '西魏文帝在长安即位，以此为都。' : '孝武帝西入关中后，魏廷驻长安。');
    }
  }

  if (frame.chapter.id === 'song') {
    const courts = [
      ['江陵',112.19,30.35,'荆南（南平）','荆南'],
      ['成都',104.07,30.67,'后蜀','后蜀'],
      ['广州',113.27,23.13,'南汉','南汉'],
      ['金陵',118.78,32.05,'南唐','南唐'],
      ['杭州',120.15,30.25,'吴越','吴越'],
      ['晋阳',112.44,37.72,'北汉','北汉']
    ];
    for (const [name,lng,lat,owner,title] of courts) {
      const active = owners.has(owner);
      place(name,lng,lat,active,active ? title : '宋',active ? title+'政权的都城。' : title+'旧都，已归宋。');
    }
  }

  if (frame.chapter.id === 'southern-song-end') {
    const handedOver = seen.has('song-end-linan');
    place('临安',120.16,30.24,!handedOver,handedOver?'元':'南宋',handedOver?'临安降元后仍是城市，宋行朝转往东南。':'临安是南宋朝廷驻地。');
    const inFuzhou = seen.has('song-end-fuzhou') && !seen.has('song-end-embark');
    place('福州',119.30,26.08,inFuzhou,'福建',inFuzhou?'赵昰在这里即位，行朝驻福州。':'闽江下游重镇，1276年福州的政权归属有变。');
  }
  return list;
}
