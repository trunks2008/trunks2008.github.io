---
title: 微信小程序支付流程详解
icon: page
order: 2
author: Hydra
date: 2020-11-22
tag:
  - 微信
  - 支付
star: true
---



<!-- more -->

最近在工作中接入了一下微信小程序支付的功能，虽然说官方文档已经比较详细了，但在使用过程中还是踩了不少的坑，整理了一下大体的流程和代码分享出来。在开始使用小程序支付功能前，需要做好以下的准备工作：

- 申请微信小程序，配置小程序id及秘钥
- 申请用于支付的微信商户平台账号，配置商户号id及商户平台秘钥，并绑定小程序与该商户号
- 后端服务在正式环境下需要`https`域名，调试模式可以不需要

先引用一张小程序支付官方说明的流程图，可以看出小程序支付的主要逻辑集中在后端，前端只需要携带参数请求后端接口，然后根据后端接口返回的数据在前端唤起微信支付即可。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2d5fb689f5a9437e9fbf382034dba8b1~tplv-k3u1fbpfcp-zoom-1.image)

按照上面流程图中商户业务系统和微信支付系统主要交互步骤，对流程进行拆解说明。

## 1、获取用户openId

小程序前端调用`wx.login()`获取登录凭证`code`，后端调用接口获取用户的`openid`和`session_key`。注意这里在发起请求的时候需要携带小程序的`appId`和`appSecret`。

```java
public OpenIdInfo code2Openid(String code){
    String url = "https://api.weixin.qq.com/sns/jscode2session";
    String param = "appid=" + mpCommonProperty.getAppid() +
            "&secret=" + mpCommonProperty.getAppsecret() +
            "&js_code=" + code +
            "&grant_type=authorization_code";

    String rs = HttpUtils.sendGet(url, param);
    JSONObject json = JSONObject.parseObject(rs);

    if (json.get("errcode") == null) {
        String openid = json.getString("openid");
        String sessionKey = json.getString("session_key");
        OpenIdInfo openIdInfo = OpenIdInfo.builder()
                .openId(openid).sessionKey(sessionKey).build();
        return openIdInfo;
    }else {
        log.error("get openid error");
        return null;
    }
}
```

需要注意每次调用接口都会刷新`session_key`的值，使之前的`session_key`失效，其他操作诸如解析用户手机号时会用到这个秘钥，为了避免该情况可以将用户的`openid`存储在业务系统的用户体系中。

## 2、调用支付统一下单

微信统一下单接口要求传递参数的形式为`xml`报文，因此需要先对参数进行拼接，这里仅列出了能够唤起小程序支付所需要的最小参数范围，更多的参数列表可以查看官方文档。

```java
public String generateUniPayXml(UnifiedParam unifiedParam){
    int money = (int) Math.ceil(unifiedParam.getTotalMoney() * 100);   //转换为分，向上取整

    Map<String,String> map=new HashMap<>();
    map.put("appid", mpCommonProperty.getAppid()); //小程序id
    map.put("mch_id", mpCommonProperty.getMuchId());  //商户号
    map.put("nonce_str",UUID.randomUUID().toString().replaceAll("-",""));   //随机字符串
    map.put("body", unifiedParam.getPayBody());    //商品描述
    map.put("out_trade_no", unifiedParam.getOrderNumber());    //商户订单号
    map.put("total_fee",String.valueOf(money)); //标价金额, 订单总金额单位为分
    map.put("spbill_create_ip",IpUtils.getInternetIp());   //终端IP
    map.put("notify_url", mpCommonProperty.getServerDomain()+ "/pay/fallback");//通知地址
    map.put("trade_type","JSAPI");//交易类型
    map.put("openid", unifiedParam.getOpenid());//用户标识,trade_type=JSAPI 时此参数必传

    String sign = signCommon(map);
    map.put("sign",sign);    //生成签名

    String xml = XmlUtil.generateXmlFromMap(map);
    log.info(xml);
    return xml;
}
```

对其中几个参数进行说明：

- `out_trade_no`：商户订单号，在我们的后台使用某种规则生成，不能重复
- `total_fee`：订单总金额，需要注意单位为分，需要转
- `body`：商品描述
- `notify_url`：支付结果的回调接口地址，使用会在后面介绍
- `sign`：签名，需要按照微信的规则生成，算法规则为去除值为空的元素，参数名`ASCII`字典序排序进行拼接，拼接API密钥，使用`Md5`进行加密：

签名方法如下：

```java
public String signCommon(Map<String,String> map){
    Set<String> emptySet=new HashSet<>();
    map.forEach((K,V)->{
        if (StringUtils.isEmpty(map.get(K))){
            emptySet.add(K);
        }
    });
    for (String key : emptySet) {
        map.remove(key);
    }

    Set<String> keySet =  map.keySet();
    String[] array = keySet.toArray(new String[keySet.size()]);
    Arrays.sort(array);

    StringBuffer sb=new StringBuffer();
    for (String key : array) {
        sb.append(key+"="+map.get(key)+"&");
    }
    sb.append("key=").append(mpCommonProperty.getMuchSecret());
    System.out.println(sb.toString());
    String md5Sign = Md5Utils.hash(sb.toString());
    return md5Sign;
}
```

以上步骤完成后，对外暴露的统一下单接口如下：

```java
public Map<String, String> unifiedOrder(UnifiedParam unifiedParam){
    String xml = mpPayUtil.generateUniPayXml(unifiedParam);
    String url= "https://api.mch.weixin.qq.com/pay/unifiedorder";
    String xmlResult  = HttpUtils.sendPost(url, xml);

    //发送请求成功
    if (xmlResult.indexOf("SUCCESS")!=-1){
        Map<String, String> parseXmlToMap = XmlUtil.parseXmlToMap(xmlResult);
        return parseXmlToMap;
    }else{
        throw new RuntimeException("统一支付错误");
    }
}
```

在调用后，会收到同步返回结果为一段`xml`报文，将其解析成`Map`后可供下一阶段使用，同步接口的返回值及错误码可以参考官方文档。

## 3、二次签名

在调用统一下单接口并收到微信的同步返回结果后，需要对其进行二次签名，需要进行签名的参数包括`appId`、`timeStamp`、`nonceStr`、`package`、`signType`。

```java
public PrepayInfo secondSign(Map<String, String> unifiedOrderMap){
    Map<String,String> map=new HashMap<>();
    map.put("appId", mpCommonProperty.getAppid());
    map.put("timeStamp",String.valueOf(System.currentTimeMillis()/1000));
    map.put("nonceStr",unifiedOrderMap.get("nonce_str"));
    map.put("package","prepay_id="+unifiedOrderMap.get("prepay_id"));
    map.put("signType",WechatConstants.signType);

    String sign = mpPayUtil.signCommon(map);
    map.put("paySign",sign);
    map.put("prePackage",unifiedOrderMap.get("prepay_id"));

    PrepayInfo prepayInfo =new PrepayInfo();
    BeanUtil.copyProperties(map, prepayInfo);
    return prepayInfo;
}
```

二次签名完成后，将`timeStamp`、`nonceStr`、`package`、`signType`、`paySign`返回给前端，这里为了方便封装了一个对象用于返回，前端在收到参数后唤起微信支付。

## 4、接收支付通知

在前面介绍的统一下单的参数中，传入了商户后端的回调地址，在支付完成后，微信会向这个调用这个回调接口，通知支付结果。

```java
@PostMapping("fallback")
public void fallback(HttpServletRequest request,HttpServletResponse response) throws IOException {
    StringBuilder sb = new StringBuilder();
    BufferedReader reader = null;
    try (InputStream inputStream = request.getInputStream()) {
        reader = new BufferedReader(new InputStreamReader(inputStream, Charset.forName("UTF-8")));
        String line = "";
        while ((line = reader.readLine()) != null) {
            sb.append(line);
        }
    } catch (IOException e) {
        log.error("getBodyString错误");
    } finally {
        if (reader != null) {
            try {
                reader.close();
            } catch (IOException e) {
                log.error(ExceptionUtils.getMessage(e));
            }
        }
    }
    
    String notifyXml=sb.toString();
    Map<String, String> params = XmlUtil.parseXmlToMap(notifyXml);
    boolean result = false;
    String resultXml;
    if ("SUCCESS".equals(params.get("return_code"))) {//通信成功,非交易标识
        //验证签名
        if (WechatPayUtil.validSignature(notifyXml)) {
            //执行业务逻辑
            result=true；
        }else{
            log.error("微信支付成功回调验证签名错误！");
        }
    }else {
        log.error("Fallback回调结果 : "+params.get("return_msg"));
    }
    
    if (result){
        resultXml="<xml><return_code><![CDATA[SUCCESS]]></return_code>" +
                "<return_msg><![CDATA[OK]]></return_msg></xml>";
    }else {
        resultXml="<xml><return_code><![CDATA[FAIL]]></return_code>"
                + "<return_msg><![CDATA[ERROR]]></return_msg></xml> ";
    }
           
    ServletOutputStream outputStream = response.getOutputStream();
    outputStream.println(result);
    outputStream.close();
}
```

在接收到返回的报文后，需要用之前同样的签名算法，验证返回报文的真实性，并在验证真实性后再执行之后的业务逻辑，防止数据泄漏导致出现的虚假通知，造成资金损失。

微信在调用回调接口时，如果收到我们业务系统的应答不符合规范或超时，会判定本次通知失败，重新发送多次通知。在通知一直不成功的情况下，按照官方文档的说明，总计在**24h4m**内会调用**15次**回调接口。因此一定要按照规定返回成功接收的报文，从一定程度上也能降低系统的负载。

在测试中发现，不能使用直接返回`String`字符串的方式进行结果的返回，仍然会一直发起回调，必须使用`HttpServletResponse`写入返回。即使这么做了，还是建议大家在回调接口内部处理业务前再做一下幂等性的处理，防止多次执行回调逻辑造成业务系统的数据混乱。