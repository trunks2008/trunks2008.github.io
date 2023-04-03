---
title: 微信开放平台授权登录流程详解
icon: page
order: 1
author: Hydra
date: 2020-09-13
tag:
  - 微信
  - 登录
star: true
---



<!-- more -->

最近在工作中用到了一些微信开放平台授权第三方登录，来获取用户基本信息的操作。看了一下微信给出的官方文档，写的已经很详细了，这里按照自己的步骤进行了一下总结，并附带了一些示例，方便大家理解。

微信公众号进行对第三方授权的流程可分为以下四步：

1. 用户同意授权，获取`code`
2. 通过code换取网页授权`access_token`
3. 刷新`access_token`（非必须）
4. 拉取用户信息(需`scope`为 `snsapi_userinfo`)

其中正常流程中，第3步为非必须步骤，仅使用在`access_token`失效的情况下，下面对每一个步骤进行详细介绍。

## 1、获取code

官方接口如下：

```
https://open.weixin.qq.com/connect/oauth2/authorize?appid=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=SCOPE&state=STATE&connect_redirect=1#wechat_redirect
```

当用户确认授权登录之后，会跳转到`redirect_uri`这个地址上，并带上微信后台生成的`code`参数，在前端可对`code`进行保存，用于后续获取`access_token`。

参数说明：

| 参数             | 必须 | 说明                                                         |
| ---------------- | ---- | ------------------------------------------------------------ |
| appid            | 是   | 公众号的唯一标识                                             |
| redirect_uri     | 是   | 授权后重定向的回调链接地址， 需使用 urlEncode 对链接进行处理 |
| response_type    | 是   | 返回类型，请填写code                                         |
| scope            | 是   | 应用授权作用域，snsapi_base 或 snsapi_userinfo               |
| state            | 否   | 重定向后会带上state参数，开发者可以填写a-zA-Z0-9的参数值，最多128字节 |
| #wechat_redirect | 是   | 无论直接打开还是做页面302重定向时候，必须带此参数            |

后端代码示例：

```java
@Controller
@RequestMapping("wechat")
public class WeChatContraller {
    @GetMapping("authorization")
    public String authorization() throws UnsupportedEncodingException {
        return "redirect:https://open.weixin.qq.com/connect/oauth2/authorize?"
                + "?appid=" + WeChatUtil.appid + "&redirect_uri="
                + URLEncoder.encode(WeChatUtil.DomainName + "/index.html", "UTF-8")
                + "&response_type=code&scope=snsapi_base&state=123#wechat_redirect";
    }
}
```

需要注意的是，由于授权操作安全等级较高，所以在发起授权请求时，微信会对授权链接做正则强匹配校验，如果链接的参数顺序不对，授权页面将无法正常访问。

并且应用授权作用域在为`snsapi_base`时，不弹出授权页面，直接跳转，只能获取用户`openid`；而在`snsapi_userinfo`时弹出授权页面，后续可通过`openid`拿到昵称、性别、所在地。并且， 即使在未关注的情况下，只要用户授权，也能获取其信息。

## 2、获取access_token

这里通过`code`换取一个特殊的网页授权`access_token`，官方接口如下：

```
https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code
```

参数说明：

| 参数       | 必须 | 说明                     |
| ---------- | ---- | ------------------------ |
| appid      | 是   | 公众号的唯一标识         |
| secret     | 是   | 公众号的appsecret        |
| code       | 是   | 填写第一步获取的code参数 |
| grant_type | 是   | 填写为authorization_code |

后端代码示例：

```java
@ResponseBody
@GetMapping("getToken")
public String getToken(@RequestParam(name = "code") String code) {
    String url = "https://api.weixin.qq.com/sns/oauth2/access_token?"
           + "?appid=" + WeChatUtil.appid + "&secret=" + WeChatUtil.appsecret
           + "&code=" + code + "&grant_type=authorization_code";
    String rs = HttpSendUtil.get(url, null);
    JSONObject json = JSONObject.parseObject(rs);
    
    if(null == json.get("errcode")){
        return json.get("access_token").toString();        
    }else{
        return "获取access_token出错";
    }
}
```

这里使用`HttpClient`发送`get`请求，从返回的JSON中取出`access_token`返回。正确返回的完整JSON数据包如下：

```json
{
  "access_token":"ACCESS_TOKEN",
  "expires_in":7200,
  "refresh_token":"REFRESH_TOKEN",
  "openid":"OPENID",
  "scope":"SCOPE" 
}
```

返回参数说明：

| 参数          | 说明                                                         |
| ------------- | ------------------------------------------------------------ |
| access_token  | 网页授权接口调用凭证,注意：此access_token与基础支持的access_token不同 |
| expires_in    | access_token接口调用凭证超时时间，单位（秒）                 |
| refresh_token | 用户刷新access_token                                         |
| openid        | 用户唯一标识                                                 |
| scope         | 用户授权的作用域，使用逗号（,）分隔                          |

错误时微信会返回JSON数据包如下（示例为code无效错误）:

```json
{
  "errcode":40029,
  "errmsg":"invalid code"
}
```

需要注意`code`只能够使用一次，如果被消费后第二次仍然用相同`code`请求获取`access_token`则会失败。

## 3、刷新access_token（非必须）

`access_token`拥有时效性，当超时失效后可以使用`refresh_token`进行刷新，需要用户重新授权。

```
https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=APPID&grant_type=refresh_token&refresh_token=REFRESH_TOKEN
```

参数说明：

| 参数          | 必须 | 说明                                          |
| ------------- | ---- | --------------------------------------------- |
| appid         | 是   | 公众号的唯一标识                              |
| grant_type    | 是   | 填写refresh_token                             |
| refresh_token | 是   | 填写通过access_token获取到的refresh_token参数 |

正确时返回的JSON数据包如下，与直接获取格式相同：

```json
{ 
  "access_token":"ACCESS_TOKEN",
  "expires_in":7200,
  "refresh_token":"REFRESH_TOKEN",
  "openid":"OPENID",
  "scope":"SCOPE" 
}
```

## 4、拉取用户信息

如果网页授权作用域为`snsapi_userinfo`，则此时开发者可以通过`access_token`和`openid`拉取用户信息了。

```
https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID&lang=zh_CN
```

参数说明：

| 参数         | 必须 | 说明                                                         |
| ------------ | ---- | ------------------------------------------------------------ |
| access_token | 是   | 网页授权接口调用凭证,注意：此access_token与基础支持的access_token不同 |
| openid       | 是   | 用户的唯一标识                                               |
| lang         | 是   | 返回国家地区语言版本，zh_CN 简体，zh_TW 繁体，en 英语        |

后端代码示例：

```java
@ResponseBody
@GetMapping("getUserInfo")
public JSONObject getUserInfo(@RequestParam(name = "accessToken") String accessToken,
                          @RequestParam(name = "openid") String openid) {
    String url = "https://api.weixin.qq.com/sns/userinfo?"
            + "?access_token=" + accessToken + "&openid=" +openid
            + "&lang=zh_CN";

    String rs = HttpSendUtil.get(url, null);
    JSONObject json = JSONObject.parseObject(rs);
    
    return json;
}
```

正确时返回的JSON数据包如下：

```json
{   
  "openid":" OPENID",
  "nickname": NICKNAME,
  "sex":"1",
  "province":"PROVINCE",
  "city":"CITY",
  "country":"COUNTRY",
  "headimgurl":"http://thirdwx.qlogo.cn/mmopen/g3MonUZtNHkdmzicIlibx6iaFqAc56vxLSUfpb6n5WKSYVY0ChQKkiaJSgQ1dZuTOgvLLrhJbERQQ4eMsv84eavHiaiceqxibJxCfHe/46",
  "privilege":[ "PRIVILEGE1" "PRIVILEGE2"],
  "unionid": "o6_bmasdasdsad6_2sgVt7hMZOPfL"
}
```

返回参数说明：

| 参数       | 说明                                                       |
| ---------- | ---------------------------------------------------------- |
| openid     | 用户的唯一标识                                             |
| nickname   | 用户昵称                                                   |
| sex        | 用户的性别，值为1时是男性，值为2时是女性，值为0时是未知    |
| province   | 用户个人资料填写的省份                                     |
| city       | 普通用户个人资料填写的城市                                 |
| country    | 国家，如中国为CN                                           |
| headimgurl | 用户头像                                                   |
| privilege  | 用户特权信息，json 数组                                    |
| unionid    | 只有在用户将公众号绑定到微信开放平台帐号后，才会出现该字段 |

错误时微信会返回JSON数据包如下（示例为openid无效）:

```json
{  
  "errcode":40003,
  "errmsg":" invalid openid "
}
```

需要注意的是，由于公众号的`secret`和获取到的`access_token`安全级别都非常高，只能保存在服务器，不允许传给客户端。后续刷新`access_token`、通过`access_token`获取用户信息等步骤，也必须从服务器发起。

总的来说，微信开放平台授权登录这一块功能应用了OAuth2的授权码模式，如果大家对OAuth2比较了解的话，这一块内容理解起来会非常容易，如果不熟的话，可以移步看一下这篇文章：OAuth2.0授权码模式实战，希望能够帮助到大家。