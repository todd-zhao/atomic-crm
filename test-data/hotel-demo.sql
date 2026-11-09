-- Hotel-industry Sandler CRM demo dataset.
--
-- Apply after `supabase db reset --local` and after the first admin user exists
-- (the role/ownership columns point at the first sales row). Disable the
-- gravatar/favicon triggers while inserting so seeding stays fast and offline.

begin;

alter table public.companies disable trigger company_saved;
alter table public.contacts disable trigger "20_contact_saved";

insert into public.tags (id, name, color) values
  (1, '决策层', '#b39ddb'),
  (2, '关键人', '#a4e87d'),
  (3, '价格敏感', '#e8cb7d')
on conflict (id) do nothing;

insert into public.companies
  (id, name, sector, customer_category, parent_company_id, size, website, phone_number,
   address, city, country, description, logo, sales_id,
   hotel_type, rooms, opening_year, hotel_services, average_room_rate)
values
  (1, '远山酒店集团', 'hotel-group', 'keep', null, 500, 'https://yuanshan.example.com', '021-6000 1000',
   '上海市黄浦区中山南路 88 号', '上海', '中国', '华东区域酒店集团，旗下 12 家在营酒店，正在推进集团级收益管理体系建设。',
   '{"src":"https://favicon.show/yuanshan.example.com","title":"Company favicon"}',
   (select id from public.sales order by id limit 1),
   null, null, null, null, null),
  (2, '上海外滩远山酒店', 'hotel', 'keep', 1, 250, 'https://bund.yuanshan.example.com', '021-6000 2001',
   '上海市黄浦区中山东一路 18 号', '上海', '中国', '外滩核心地段五星级酒店，320 间客房，餐饮与宴会收入占比高。',
   '{"src":"https://favicon.show/bund.yuanshan.example.com","title":"Company favicon"}',
   (select id from public.sales order by id limit 1),
   'local_chain', 320, 2015, array['rooms','restaurant','meeting'], 980),
  (3, '杭州西子远山度假酒店', 'hotel', 'expand', 1, 250, 'https://xizi.yuanshan.example.com', '0571-8000 3001',
   '杭州市西湖区杨公堤 6 号', '杭州', '中国', '西湖景区度假酒店，180 间客房，周末与节假日出租率长期高位。',
   '{"src":"https://favicon.show/xizi.yuanshan.example.com","title":"Company favicon"}',
   (select id from public.sales order by id limit 1),
   'local_chain', 180, 2018, array['rooms','restaurant','entertainment'], 1280),
  (4, '成都天府云栖酒店', 'hotel', 'acquire', null, 50, 'https://tianfu.yunqi.example.com', '028-7000 4001',
   '成都市天府新区天府大道南段 888 号', '成都', '中国', '天府新区商务会议酒店，260 间客房，2020 年开业，正在筛选收益管理系统。',
   '{"src":"https://favicon.show/tianfu.yunqi.example.com","title":"Company favicon"}',
   (select id from public.sales order by id limit 1),
   'independent', 260, 2020, array['rooms','restaurant','meeting'], 620),
  (5, '深圳湾云栖精品酒店', 'hotel', 'acquire', null, 10, 'https://shenzhen.yunqi.example.com', '0755-6000 5001',
   '深圳市南山区滨海大道 3001 号', '深圳', '中国', '90 间房的精品设计酒店，主打私域会员与内容营销。',
   '{"src":"https://favicon.show/shenzhen.yunqi.example.com","title":"Company favicon"}',
   (select id from public.sales order by id limit 1),
   'independent', 90, 2021, array['rooms','restaurant'], 750),
  (6, '北京中关村国际酒店', 'hotel', 'recover', null, 500, 'https://zgc.international.example.com', '010-5000 6001',
   '北京市海淀区中关村大街 1 号', '北京', '中国', '国际联号管理的中关村商务酒店，400 间客房，曾使用竞品系统后续约失败。',
   '{"src":"https://favicon.show/zgc.international.example.com","title":"Company favicon"}',
   (select id from public.sales order by id limit 1),
   'international_chain', 400, 2010, array['rooms','restaurant','meeting','entertainment'], 1100),
  (7, '苏州金鸡湖云栖酒店', 'hotel', 'acquire', null, 50, 'https://suzhou.yunqi.example.com', '0512-6000 7001',
   '苏州市工业园区星港街 168 号', '苏州', '中国', '金鸡湖商圈会议型酒店，220 间客房，宴会销售占比高。',
   '{"src":"https://favicon.show/suzhou.yunqi.example.com","title":"Company favicon"}',
   (select id from public.sales order by id limit 1),
   'independent', 220, 2019, array['rooms','restaurant','meeting'], 880);

insert into public.contacts
  (id, name, first_name, last_name, gender, title, background, avatar, first_seen, last_seen,
   has_newsletter, status, tags, company_id, sales_id, wechat_id, contact_type, birthday,
   communication_style, attitude, tenure_years, social_organization, work_experience, education,
   email_jsonb, phone_jsonb)
values
  (1, '张伟', null, null, 'male', '总经理', '外滩远山酒店总经理，关注 RevPAR 与直接预订占比，决策风格强势。', null,
   '2026-08-12', '2026-10-30', false, 'warm', array[1,2], 2,
   (select id from public.sales order by id limit 1), 'wxid_zhangwei', 'customer', '1978-05-21',
   'D', 'support', 6.5, 'hotel_association',
   '[{"start_year":2012,"end_year":2018,"company":"杭州西子远山度假酒店","title":"市场销售总监"},{"start_year":2018,"end_year":null,"company":"上海外滩远山酒店","title":"总经理"}]'::jsonb,
   '[{"start_year":1996,"end_year":2000,"school":"上海交通大学","major":"酒店管理","degree":"bachelor"}]'::jsonb,
   '[{"email":"zhangwei@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001001","type":"Work"}]'::jsonb),
  (2, '李娜', null, null, 'female', '市场销售总监', '负责外滩远山酒店的市场与销售团队，关注渠道成本与宴会收入。', null,
   '2026-08-15', '2026-10-28', true, 'hot', array[2], 2,
   (select id from public.sales order by id limit 1), 'wxid_lina', 'customer', '1985-03-08',
   'I', 'friendly', 3.0, 'tourism_association',
   '[{"start_year":2015,"end_year":2021,"company":"上海外滩茂悦大酒店","title":"销售副总监"},{"start_year":2021,"end_year":null,"company":"上海外滩远山酒店","title":"市场销售总监"}]'::jsonb,
   '[{"start_year":2003,"end_year":2007,"school":"上海师范大学","major":"旅游管理","degree":"bachelor"}]'::jsonb,
   '[{"email":"lina@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001002","type":"Work"}]'::jsonb),
  (3, '王强', null, null, 'male', '收益管理经理', '收益管理负责人，习惯用数据说话，对系统报表与自动化要求高。', null,
   '2026-08-20', '2026-10-29', false, 'warm', array[2], 2,
   (select id from public.sales order by id limit 1), 'wxid_wangqiang', 'customer', '1990-11-02',
   'C', 'neutral', 2.5, 'hotel_association',
   '[{"start_year":2017,"end_year":2022,"company":"华住集团","title":"收益分析师"},{"start_year":2022,"end_year":null,"company":"上海外滩远山酒店","title":"收益管理经理"}]'::jsonb,
   '[{"start_year":2008,"end_year":2012,"school":"华东师范大学","major":"统计学","degree":"bachelor"}]'::jsonb,
   '[{"email":"wangqiang@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001003","type":"Work"}]'::jsonb),
  (4, '刘洋', null, null, 'female', '采购总监', '集团采购负责人，关注合同条款、实施周期与总体拥有成本。', null,
   '2026-08-22', '2026-10-27', false, 'warm', array[1,3], 1,
   (select id from public.sales order by id limit 1), 'wxid_liuyang', 'customer', '1982-07-19',
   'S', 'neutral', 8.0, 'entrepreneur_club',
   '[{"start_year":2008,"end_year":2016,"company":"远山酒店集团","title":"采购经理"},{"start_year":2016,"end_year":null,"company":"远山酒店集团","title":"采购总监"}]'::jsonb,
   '[{"start_year":2000,"end_year":2004,"school":"南京大学","major":"工商管理","degree":"master"}]'::jsonb,
   '[{"email":"liuyang@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001004","type":"Work"}]'::jsonb),
  (5, '陈静', null, null, 'female', 'IT 经理', '酒店 IT 负责人，负责系统对接、数据安全与上线实施。', null,
   '2026-08-25', '2026-10-26', false, 'cold', array[2], 2,
   (select id from public.sales order by id limit 1), 'wxid_chenjing', 'customer', '1988-09-14',
   'C', 'cold', 4.0, 'alumni',
   '[{"start_year":2016,"end_year":2019,"company":"上海某五星级酒店","title":"IT 主管"},{"start_year":2019,"end_year":null,"company":"上海外滩远山酒店","title":"IT 经理"}]'::jsonb,
   '[{"start_year":2006,"end_year":2010,"school":"上海大学","major":"计算机科学与技术","degree":"bachelor"}]'::jsonb,
   '[{"email":"chenjing@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001005","type":"Work"}]'::jsonb),
  (6, '赵磊', null, null, 'male', '集团运营总监', '远山集团运营负责人，集团级项目的最终推动者，关注多店复制与标准化。', null,
   '2026-08-10', '2026-10-31', false, 'hot', array[1], 1,
   (select id from public.sales order by id limit 1), 'wxid_zhaolei', 'customer', '1976-02-11',
   'D', 'friendly', 9.0, 'hotel_association',
   '[{"start_year":2006,"end_year":2014,"company":"洲际酒店集团","title":"区域运营经理"},{"start_year":2014,"end_year":null,"company":"远山酒店集团","title":"集团运营总监"}]'::jsonb,
   '[{"start_year":1994,"end_year":1998,"school":"浙江大学","major":"旅游管理","degree":"bachelor"}]'::jsonb,
   '[{"email":"zhaolei@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001006","type":"Work"}]'::jsonb),
  (7, '孙丽', null, null, 'female', '总经理', '杭州西子远山度假酒店总经理，关注度假客群与直接预订。', null,
   '2026-09-01', '2026-10-25', true, 'warm', array[1,2], 3,
   (select id from public.sales order by id limit 1), 'wxid_sunli', 'customer', '1980-12-03',
   'I', 'friendly', 5.0, 'tourism_association',
   '[{"start_year":2010,"end_year":2019,"company":"杭州某度假酒店","title":"驻店经理"},{"start_year":2019,"end_year":null,"company":"杭州西子远山度假酒店","title":"总经理"}]'::jsonb,
   '[{"start_year":1998,"end_year":2002,"school":"浙江工商大学","major":"酒店管理","degree":"bachelor"}]'::jsonb,
   '[{"email":"sunli@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001007","type":"Work"}]'::jsonb),
  (8, '周杰', null, null, 'male', '市场总监', '负责西湖度假酒店的渠道与内容营销，对私域运营感兴趣。', null,
   '2026-09-03', '2026-10-24', true, 'warm', array[2], 3,
   (select id from public.sales order by id limit 1), 'wxid_zhoujie', 'customer', '1987-06-22',
   'I', 'neutral', 2.0, 'alumni',
   '[{"start_year":2018,"end_year":2023,"company":"携程集团","title":"目的地营销经理"},{"start_year":2023,"end_year":null,"company":"杭州西子远山度假酒店","title":"市场总监"}]'::jsonb,
   '[{"start_year":2005,"end_year":2009,"school":"浙江传媒学院","major":"广告学","degree":"bachelor"}]'::jsonb,
   '[{"email":"zhoujie@yuanshan.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001008","type":"Work"}]'::jsonb),
  (9, '吴敏', null, null, 'female', '收益经理', '成都天府云栖酒店收益经理，正在对比三家收益管理系统。', null,
   '2026-09-10', '2026-10-23', false, 'warm', array[2], 4,
   (select id from public.sales order by id limit 1), 'wxid_wumin', 'customer', '1992-01-30',
   'S', 'friendly', 1.5, null,
   '[{"start_year":2018,"end_year":2024,"company":"成都某商务酒店","title":"收益主管"},{"start_year":2024,"end_year":null,"company":"成都天府云栖酒店","title":"收益经理"}]'::jsonb,
   '[{"start_year":2010,"end_year":2014,"school":"西南财经大学","major":"旅游管理","degree":"bachelor"}]'::jsonb,
   '[{"email":"wumin@yunqi.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001009","type":"Work"}]'::jsonb),
  (10, '郑浩', null, null, 'male', '总经理', '成都天府云栖酒店总经理，务实，关注投入产出和上线速度。', null,
   '2026-09-12', '2026-10-22', false, 'warm', array[1], 4,
   (select id from public.sales order by id limit 1), 'wxid_zhenghao', 'customer', '1979-08-16',
   'D', 'support', 3.0, null,
   '[{"start_year":2013,"end_year":2022,"company":"成都某会议酒店","title":"副总经理"},{"start_year":2022,"end_year":null,"company":"成都天府云栖酒店","title":"总经理"}]'::jsonb,
   '[{"start_year":1997,"end_year":2001,"school":"四川大学","major":"工商管理","degree":"bachelor"}]'::jsonb,
   '[{"email":"zhenghao@yunqi.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001010","type":"Work"}]'::jsonb),
  (11, '冯雪', null, null, 'female', '销售总监', '深圳湾云栖精品酒店销售负责人，关注内容营销与会员复购。', null,
   '2026-09-15', '2026-10-21', true, 'cold', array[3], 5,
   (select id from public.sales order by id limit 1), 'wxid_fengxue', 'customer', '1991-04-05',
   'I', 'cold', 1.0, null,
   '[{"start_year":2017,"end_year":2024,"company":"深圳某精品酒店","title":"销售经理"},{"start_year":2024,"end_year":null,"company":"深圳湾云栖精品酒店","title":"销售总监"}]'::jsonb,
   '[{"start_year":2009,"end_year":2013,"school":"深圳大学","major":"市场营销","degree":"bachelor"}]'::jsonb,
   '[{"email":"fengxue@yunqi.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001011","type":"Work"}]'::jsonb),
  (12, '何军', null, null, 'male', '采购经理', '北京中关村国际酒店采购经理，重视供应商资质与集团合规。', null,
   '2026-09-18', '2026-10-20', false, 'cold', array[3], 6,
   (select id from public.sales order by id limit 1), 'wxid_hejun', 'customer', '1984-10-12',
   'C', 'cold', 7.0, null,
   '[{"start_year":2010,"end_year":2018,"company":"北京某国际联号酒店","title":"采购主管"},{"start_year":2018,"end_year":null,"company":"北京中关村国际酒店","title":"采购经理"}]'::jsonb,
   '[{"start_year":2002,"end_year":2006,"school":"北京第二外国语学院","major":"酒店管理","degree":"bachelor"}]'::jsonb,
   '[{"email":"hejun@international.example.com","type":"Work"}]'::jsonb,
   '[{"number":"13800001012","type":"Work"}]'::jsonb);

insert into public.competitors (id, name, brand_influence, market_price, advantages, weaknesses, sales_id) values
  (1, '石基信息', 'high', 'high', '酒店 PMS/CRS 一体化，集团客户基础强，生态完整。', '实施周期长、定制成本高，单体酒店响应慢。', (select id from public.sales order by id limit 1)),
  (2, '德比软件', 'high', 'high', '全球渠道直连经验丰富，海外分销网络广。', '收益管理模块较弱，本地化服务依赖合作伙伴。', (select id from public.sales order by id limit 1)),
  (3, '绿云科技', 'medium', 'medium', '性价比高、上线快，单体与中小连锁酒店案例多。', '大型集团案例少，高级收益算法能力有限。', (select id from public.sales order by id limit 1))
on conflict (id) do nothing;

insert into public.deals
  (id, name, company_id, stage, status, deal_type, description, decision_process, budget,
   final_amount, expected_closing_date, sales_id, competitor_id, index)
values
  (1, '上海外滩远山酒店 2026 收益管理系统项目', 2, 'budget', 'active', 'new',
   '替换现有手工报表，引入自动化收益管理与直连渠道比价。',
   '张伟（总经理）发起 -> 赵磊（集团运营）审批 -> 刘洋（采购）比价 -> 陈静（IT）评估接口与安全。',
   480000, null, '2026-01-31', (select id from public.sales order by id limit 1), 1, 1),
  (2, '杭州西子远山度假酒店 直销增长项目', 3, 'pain', 'active', 'new',
   'OTA 佣金占比过高，希望提升官网与微信小程序直接预订。',
   '孙丽（总经理）主导 -> 周杰（市场）落地 -> 集团市场部复核。',
   320000, null, '2026-02-28', (select id from public.sales order by id limit 1), 2, 2),
  (3, '成都天府云栖酒店 收益管理 SaaS 续约', 4, 'solution', 'won', 'renewal',
   '现有系统续约，增加多渠道比价与自动调价模块。',
   '郑浩（总经理）拍板 -> 吴敏（收益）评估 -> 采购走集团框架合同。',
   180000, 168000, '2025-12-15', (select id from public.sales order by id limit 1), 3, 1),
  (4, '北京中关村国际酒店 集团版收益管理', 6, 'contact', 'potential', 'new',
   '恢复合作机会：客户对上一家供应商的续约价格与服务不满意。',
   '需先接触采购何军，再争取运营总监与集团 IT 评估。',
   900000, null, '2026-03-31', (select id from public.sales order by id limit 1), 1, 2),
  (5, '深圳湾云栖精品酒店 私域营销方案', 5, 'budget', 'exited', 'new',
   '客户预算收缩，项目暂缓，转向低价竞品。',
   '冯雪（销售总监）推动，但总经理未批预算。',
   120000, null, '2025-11-30', (select id from public.sales order by id limit 1), 2, 1),
  (6, '苏州金鸡湖云栖酒店 2026 增购-宴会销售模块', 7, 'decision', 'active', 'upsell',
   '在现有收益管理基础上增购宴会与会议销售模块。',
   '酒店总经理审批，集团采购确认增购价格。',
   150000, null, '2026-01-15', (select id from public.sales order by id limit 1), null, 3),
  (7, '远山酒店集团 会员体系与集团收益中台', 1, 'solution', 'active', 'new',
   '集团级会员与收益中台项目，先在外滩与西子两家试点。',
   '赵磊（集团运营）牵头 -> 集团 IT 与财务评审 -> 集团总裁终审。',
   1200000, null, '2026-04-30', (select id from public.sales order by id limit 1), 1, 4);

insert into public.deal_contacts (deal_id, contact_id, role, attitude, influence, pain, index) values
  (1, 1, 'decision_maker', 'support', 'high', '担心换系统影响旺季运营，需要平滑迁移方案。', 1),
  (1, 2, 'influencer', 'friendly', 'high', '渠道佣金高，希望系统直接给出直连与比价建议。', 2),
  (1, 3, 'user', 'neutral', 'medium', '现有报表手工整理耗时，希望自动化。', 3),
  (1, 5, 'gatekeeper', 'cold', 'medium', '关注数据安全与接口稳定性，担心上线风险。', 4),
  (2, 7, 'decision_maker', 'friendly', 'high', '度假客群依赖 OTA，希望提升直订比例。', 1),
  (2, 8, 'influencer', 'neutral', 'medium', '缺少内容与私域运营工具，会员复购低。', 2),
  (3, 10, 'decision_maker', 'support', 'high', '希望减少人工调价，提升 RevPAR。', 1),
  (3, 9, 'user', 'friendly', 'medium', '需要更细的渠道成本报表。', 2),
  (4, 12, 'gatekeeper', 'cold', 'medium', '上一家供应商服务响应慢，重新评估供应商。', 1),
  (5, 11, 'influencer', 'cold', 'low', '预算被砍，项目优先级下降。', 1),
  (6, 7, 'decision_maker', 'friendly', 'high', '宴会销售预测与场地排期仍靠 Excel。', 1),
  (7, 6, 'decision_maker', 'support', 'high', '集团多店数据不统一，需要中台统一口径。', 1),
  (7, 4, 'gatekeeper', 'neutral', 'medium', '集团采购关注总拥有成本与实施排期。', 2);

insert into public.deal_pains (deal_id, symptom, cause, duration, quantified_loss, index) values
  (1, '收益报表每周手工汇总 2 天', 'PMS 与渠道数据分散，缺少自动清洗', '持续 8 个月', '每月约损失 3 个可优化定价窗口', 1),
  (1, '旺季不敢提价，出租率与价格不匹配', '缺少竞品价格与需求预测', '持续 1 年', '估算年收入损失 60-80 万元', 2),
  (2, 'OTA 佣金占比 22%', '官网与小程序转化链路长，缺少会员权益', '持续 2 年', '年佣金支出约 150 万元', 1),
  (3, '调价依赖人工，响应慢', '现有系统无自动调价策略', '持续 6 个月', 'RevPAR 低于同商圈 8%', 1),
  (4, '竞品续约涨价 30%', '供应商锁定与合同到期', '持续 1 个月', '年成本增加约 25 万元', 1),
  (6, '宴会场地排期与销售预测靠 Excel', '缺少宴会销售模块', '持续 5 个月', '宴会档期利用率仅 62%', 1),
  (7, '多店会员权益与价格策略不统一', '集团缺少统一会员与收益中台', '持续 3 年', '会员复购率低于行业均值 10 个百分点', 1);

insert into public.deal_milestones (deal_id, event, date, index) values
  (1, '需求调研与系统演示', '2025-10-15', 1),
  (1, '提交预算方案', '2025-11-20', 2),
  (1, '集团采购比价', '2025-12-10', 3),
  (2, '直订增长方案沟通', '2025-11-05', 1),
  (2, '客户内部立项', '2025-12-15', 2),
  (3, '续约合同签署', '2025-11-25', 1),
  (4, '恢复联系与需求确认', '2026-01-10', 1),
  (6, '增购方案确认', '2025-12-20', 1),
  (7, '集团试点方案评审', '2025-12-05', 1);

insert into public.deal_meetings
  (deal_id, meeting_date, customer_attendee_ids, our_attendee_ids, content, next_steps)
values
  (1, '2025-11-20', array[1,2,3,5], array[(select id from public.sales order by id limit 1)],
   '演示收益管理看板与自动比价，客户对自动调价最感兴趣，IT 提出接口与安全清单。',
   '两周内提供接口方案与分阶段上线计划。'),
  (2, '2025-11-05', array[7,8], array[(select id from public.sales order by id limit 1)],
   '讨论 OTA 佣金结构与直订增长路径，客户希望先做小程序会员。',
   '输出会员与直订增长试点方案。'),
  (3, '2025-11-25', array[10,9], array[(select id from public.sales order by id limit 1)],
   '续约条款与增购模块沟通，客户确认续约价格 16.8 万。',
   '发送续约合同并安排上线培训。'),
  (4, '2026-01-10', array[12], array[(select id from public.sales order by id limit 1)],
   '与采购何军初步沟通，客户愿意重新评估供应商，需要提供集团级案例。',
   '准备集团案例与合规材料，约运营总监会议。'),
  (6, '2025-12-20', array[7], array[(select id from public.sales order by id limit 1)],
   '确认宴会销售模块需求与增购价格区间。',
   '提交增购报价单。'),
  (7, '2025-12-05', array[6,4], array[(select id from public.sales order by id limit 1)],
   '集团会员与收益中台方案评审，客户认可试点思路，要求补充投入产出测算。',
   '补充 ROI 测算与试点门店计划。');

insert into public.contact_notes (id, contact_id, text, date, sales_id, status) values
  (1, 1, '客户提到集团正在做 2026 年数字化预算，收益管理优先级高。', '2025-11-20 10:00:00+08', (select id from public.sales order by id limit 1), 'hot'),
  (2, 3, '王强希望看自动调价的规则配置与回测数据。', '2025-11-21 15:30:00+08', (select id from public.sales order by id limit 1), 'warm'),
  (3, 6, '赵磊关注多店复制与集团统一报表，安排下周试点评审。', '2025-12-01 09:20:00+08', (select id from public.sales order by id limit 1), 'hot'),
  (4, 8, '周杰提出会员小程序先做西湖店试点，预算 30 万以内。', '2025-11-06 16:10:00+08', (select id from public.sales order by id limit 1), 'warm');

insert into public.deal_notes (id, deal_id, text, date, sales_id) values
  (1, 1, '客户内部已立项，进入预算审批阶段。', '2025-11-25 11:00:00+08', (select id from public.sales order by id limit 1)),
  (2, 2, '客户希望春节前完成试点上线。', '2025-12-18 14:00:00+08', (select id from public.sales order by id limit 1)),
  (3, 7, '集团要求补充 ROI 测算，已转交方案团队。', '2025-12-08 10:30:00+08', (select id from public.sales order by id limit 1));

insert into public.tasks (id, contact_id, type, text, due_date, done_date, sales_id, created_at) values
  (1, 1, 'call', '回访张伟：确认预算审批进度', '2026-11-05 10:00:00+08', null, (select id from public.sales order by id limit 1), now()),
  (2, 3, 'email', '发送自动调价规则与回测数据', '2026-11-06 18:00:00+08', null, (select id from public.sales order by id limit 1), now()),
  (3, 6, 'meeting', '集团试点方案评审会', '2026-11-10 14:00:00+08', null, (select id from public.sales order by id limit 1), now()),
  (4, 12, 'call', '约何军与运营总监见面', '2026-11-07 11:00:00+08', null, (select id from public.sales order by id limit 1), now()),
  (5, 9, 'follow-up', '续约培训安排', '2025-12-20 10:00:00+08', '2025-12-19 16:00:00+08', (select id from public.sales order by id limit 1), now());

-- Channel directory (other companies) + public-pool demo deals.
insert into public.companies
  (id, name, company_kind, channel_type, sector, size, website, phone_number, address, city, country, description, logo, sales_id)
values
  (8, '携程旅行网', 'channel', 'ota', 'travel', 500, 'https://ctrip.example.com', '021-8000 8001', '上海市长宁区金钟路 968 号', '上海', '中国', '头部 OTA 渠道，酒店直连与分销合作。', '{"src":"https://favicon.show/ctrip.example.com","title":"Company favicon"}', (select id from public.sales order by id limit 1)),
  (9, '中青旅控股', 'channel', 'travel_agency', 'travel', 250, 'https://cyts.example.com', '010-8000 9001', '北京市东城区东直门南大街 5 号', '北京', '中国', '全国性旅行社集团，会议与奖励旅游客源稳定。', '{"src":"https://favicon.show/cyts.example.com","title":"Company favicon"}', (select id from public.sales order by id limit 1)),
  (10, '会唐网', 'channel', 'meeting_agency', 'conference', 50, 'https://meeting.example.com', '010-8000 1001', '北京市朝阳区建国路 88 号', '北京', '中国', '会议与活动采购平台，覆盖大量企业会议需求。', '{"src":"https://favicon.show/meeting.example.com","title":"Company favicon"}', (select id from public.sales order by id limit 1)),
  (11, '环球企业协议服务', 'channel', 'corporate_agreement', 'travel', 10, 'https://global-agreement.example.com', '021-8000 1101', '上海市静安区南京西路 1266 号', '上海', '中国', '企业协议与差旅管理服务商，掌握多家集团客户协议。', '{"src":"https://favicon.show/global-agreement.example.com","title":"Company favicon"}', (select id from public.sales order by id limit 1)),
  (12, '南京河西云栖酒店', 'hotel', null, 'hotel', 50, 'https://nanjing.yunqi.example.com', '025-8000 1201', '南京市建邺区江东中路 300 号', '南京', '中国', '河西新城商务酒店，180 间客房，正在选型收益管理系统。', '{"src":"https://favicon.show/nanjing.yunqi.example.com","title":"Company favicon"}', (select id from public.sales order by id limit 1));

update public.companies set hotel_type = 'independent', rooms = 180, opening_year = 2022,
  hotel_services = array['rooms','restaurant','meeting'], average_room_rate = 560
where id = 12;

insert into public.contacts
  (id, name, title, company_id, sales_id, wechat_id, contact_type, attitude, communication_style, gender, tags, status, first_seen, last_seen, email_jsonb, phone_jsonb)
values
  (13, '王芳', '渠道合作总监', 8, (select id from public.sales order by id limit 1), 'wxid_wangfang', 'channel', 'friendly', 'I', 'female', array[2], 'warm', '2026-09-20', '2026-10-29',
   '[{"email":"wangfang@ctrip.example.com","type":"Work"}]'::jsonb, '[{"number":"13800001013","type":"Work"}]'::jsonb),
  (14, '张涛', '会议采购经理', 10, (select id from public.sales order by id limit 1), 'wxid_zhangtao', 'channel', 'neutral', 'C', 'male', array[3], 'cold', '2026-09-22', '2026-10-25',
   '[{"email":"zhangtao@meeting.example.com","type":"Work"}]'::jsonb, '[{"number":"13800001014","type":"Work"}]'::jsonb);

-- Referral relationships (a contact can be introduced by another contact).
update public.contacts set referrer_contact_id = 1 where id in (2, 3, 10, 13);
update public.contacts set referrer_contact_id = 2 where id in (4, 6);
update public.contacts set referrer_contact_id = 4 where id = 5;
update public.contacts set referrer_contact_id = 6 where id = 12;
update public.contacts set referrer_contact_id = 7 where id = 8;
update public.contacts set referrer_contact_id = 10 where id = 9;

update public.deals set source_type = 'channel', channel_id = 8 where id = 2;
update public.deals set source_type = 'channel', channel_id = 10 where id = 4;
update public.deals set source_type = 'channel', channel_id = 9 where id = 5;
update public.deals set source_type = 'channel', channel_id = 11 where id = 7;

insert into public.deals
  (id, name, company_id, stage, status, deal_type, source_type, channel_id, description, decision_process, budget, expected_closing_date, sales_id, competitor_id, index)
values
  (8, '上海外滩远山酒店 2027 收益管理续约', 2, 'contact', 'potential', 'renewal', 'direct', null,
   '2026 项目上线后的年度续约机会，暂未分配销售负责人，进入公海。', '待认领后由销售负责人确认续约决策链。',
   200000, '2027-01-31', null, null, 3),
  (9, '南京河西云栖酒店 收益管理系统选型', 12, 'pain', 'potential', 'new', 'direct', null,
   '新开业酒店首次选型，暂无销售负责人，进入公海。', '由酒店总经理与收益经理共同评估。',
   260000, '2026-06-30', null, 1, 4);

alter table public.companies enable trigger company_saved;
alter table public.contacts enable trigger "20_contact_saved";

select setval(pg_get_serial_sequence('public.tags', 'id'), (select max(id) from public.tags));
select setval(pg_get_serial_sequence('public.companies', 'id'), (select max(id) from public.companies));
select setval(pg_get_serial_sequence('public.contacts', 'id'), (select max(id) from public.contacts));
select setval(pg_get_serial_sequence('public.competitors', 'id'), (select max(id) from public.competitors));
select setval(pg_get_serial_sequence('public.deals', 'id'), (select max(id) from public.deals));
select setval(pg_get_serial_sequence('public.deal_contacts', 'id'), (select max(id) from public.deal_contacts));
select setval(pg_get_serial_sequence('public.deal_pains', 'id'), (select max(id) from public.deal_pains));
select setval(pg_get_serial_sequence('public.deal_milestones', 'id'), (select max(id) from public.deal_milestones));
select setval(pg_get_serial_sequence('public.deal_meetings', 'id'), (select max(id) from public.deal_meetings));
select setval(pg_get_serial_sequence('public.contact_notes', 'id'), (select max(id) from public.contact_notes));
select setval(pg_get_serial_sequence('public.deal_notes', 'id'), (select max(id) from public.deal_notes));
select setval(pg_get_serial_sequence('public.tasks', 'id'), (select max(id) from public.tasks));

commit;
