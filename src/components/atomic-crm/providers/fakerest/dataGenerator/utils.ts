import faker from "faker/locale/en";

export const weightedArrayElement = (values: any[], weights: any) =>
  faker.random.arrayElement(
    values.reduce(
      (acc, value, index) => acc.concat(new Array(weights[index]).fill(value)),
      [],
    ),
  );

export const weightedBoolean = (likelyhood: number) =>
  faker.datatype.number(99) < likelyhood;

export const randomDate = (minDate?: Date, maxDate?: Date) => {
  const minTs =
    minDate instanceof Date
      ? minDate.getTime()
      : Date.now() - 5 * 365 * 24 * 60 * 60 * 1000; // 5 years
  const maxTs = maxDate instanceof Date ? maxDate.getTime() : Date.now();
  const range = maxTs - minTs;
  const randomRange = faker.datatype.number({ max: range });
  // move it more towards today to account for traffic increase
  const ts = Math.sqrt(randomRange / range) * range;
  return new Date(minTs + ts);
};

export const randomFloat = (min: number, max: number) =>
  parseFloat(faker.datatype.number({ min, max, precision: 0.01 }).toFixed(2));

// The demo data is generated with English Faker names, while the CRM also
// supports a full display name following the Chinese convention. This pool
// feeds that optional `name` column so the demo shows both name models.
const chineseFullNames = [
  "张伟",
  "王芳",
  "李娜",
  "刘洋",
  "陈静",
  "杨帆",
  "赵敏",
  "黄磊",
  "周杰",
  "吴婷",
];

export const chineseFullName = () =>
  faker.random.arrayElement(chineseFullNames);
