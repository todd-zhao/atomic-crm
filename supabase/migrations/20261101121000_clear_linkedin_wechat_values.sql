-- Old LinkedIn profile URLs are not WeChat IDs.
--
-- The contacts column formerly named `linkedin_url` is now `wechat_id`. Existing
-- values that are LinkedIn URLs would otherwise be displayed as 微信号, so drop
-- them (users can enter their real WeChat ID afterwards).

update public.contacts
   set wechat_id = null
 where wechat_id ~* '^https?://([a-z0-9-]+\.)*linkedin\.com/';
