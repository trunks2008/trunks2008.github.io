---
title: 微信小程序退款流程详解
icon: page
order: 3
author: Hydra
date: 2020-11-29
tag:
  - 微信
  - 支付
star: true
---



<!-- more -->

在之前的文章中我们介绍了微信小程序的支付流程，这一篇接着讲一下小程序的退款流程，首先看一下官方给出的介绍：

> 当交易发生之后一段时间内，由于买家或者卖家的原因需要退款时，卖家可以通过退款接口将支付款退还给买家，微信支付将在收到退款请求并且验证成功之后，按照退款规则将支付款按原路退到买家帐号上。

和付款流程不同，退款流程不再需要在前端页面额外调用微信接口，可由后端独立完成。可分为以下3步：

- 服务后端发送退款请求
- 接收微信同步返回结果
- 接收微信调用回调接口返回异步消息

## 1、调用微信退款接口

生成退款参数及发送请求方法如下，和付款的统一支付接口相同，首先需要对请求中的参数进行签名，之后再发送`http`请求：

 ```java
public String refund(String orderNumber, String refundNumber, double totalFee, double refundFee, String notifyUrl) {
    int totalMoney = new Double(Math.ceil(totalFee * 100)).intValue();   //转换为分
    int refundMoney = new Double(Math.ceil(refundFee * 100)).intValue();   //转换为分

    Map<String, String> wxMap = new HashMap<>();
    wxMap.put("appid", mpCommonProperty.getAppid());
    wxMap.put("mch_id", mpCommonProperty.getMuchId());
    wxMap.put("nonce_str", UUID.randomUUID().toString().replaceAll("-", ""));
    wxMap.put("notify_url", mpCommonProperty.getServerDomain() + notifyUrl);
    wxMap.put("out_refund_no", refundNumber);
    wxMap.put("out_trade_no", orderNumber);
    wxMap.put("refund_fee", String.valueOf(refundMoney));
    wxMap.put("total_fee", String.valueOf(totalMoney));
    wxMap.put("sign", mpPayUtil.signCommon(wxMap));

    String refundXml = XmlUtil.generateXmlFromMap(wxMap);
    String url = https://api.mch.weixin.qq.com/secapi/pay/refund";

    String xmlResult = null;
    try {
        xmlResult = mpCertificateUtil.doWxpayRequest(url, refundXml);
    } catch (Exception e) {
        e.printStackTrace();
    }
    log.info("xmlResult:" + xmlResult);
    return xmlResult;
}
 ```

参数说明：

- `orderNumber`：需要执行退款的订单号
- `refundNumber`：业务系统生成的退款单号
- `totalFee`：订单总金额，如果业务系统单位为元，需要在发送请求前转化为分
- `refundFee`：本次退款金额，同上
- `notifyUrl`：接收通知的回调接口地址

微信退款支持一笔订单分多次退款，上面的方法可以用于执行部分退款操作，如果是执行一次性全部退款的话，那么可以重载上面的方法，减少传入的参数：

```java
public String refund(String orderNumber,double totalFee,String notifyUrl){
    return refund(orderNumber,orderNumber,totalFee,totalFee,notifyUrl);
}
```

需要注意，和付款发送请求不同的是这里不能直接发起http请求，需要使用微信商户平台生成的证书。证书的申请流程也不复杂，登录商户平台，在账户中心点击申请API证书，下载证书工具后通过验证商户信息可以自动生成。在生成完`pkcs12`证书后，在每次发送退款请求时需要携带证书的信息。

下面是证书工具类，提供加载证书及发送携带证书的请求功能：

```java
public class MPCertificateUtil {
    @Autowired
    MPCommonProperty mpCommonProperty;
    /**
     * 加载证书文件流，通过hex解析为16进制存到静态变量里
    */
    public String parseCertificateFile(){
        String haxString=null;
        try {
            ClassPathResource classPathResource=new ClassPathResource(mpCommonProperty.getCertFilePath());
            InputStream inputStream=classPathResource.getStream();
            haxString = Hex.encodeHexString(StreamUtils.copyToByteArray(inputStream));
        } catch (Exception e) {
            log.error("fileError:"+e.getMessage());
            e.printStackTrace();
        }
        return haxString;
    }

    /**
     * 发送微信携带证书请求
    */
    public String doWxpayRequest(String httpurl, String strxml) throws Exception {
        String cert = parseCertificateFile();
        if(StringUtils.isEmpty(cert)){
            throw new RuntimeException("cert is null");
        }

        CloseableHttpClient client = null;
        HttpPost httpPost = null;
        try {
            // 解密出16进制原证书文件内容为字节数组
            byte[] bytes = Hex.decodeHex(cert.toCharArray());
            ByteArrayInputStream input = new ByteArrayInputStream(bytes);
            KeyStore clientTrustKeyStore = KeyStore.getInstance("PKCS12");
            clientTrustKeyStore.load(input, mpCommonProperty.getMuchId().toCharArray());
            KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(clientTrustKeyStore, mpCommonProperty.getMuchId().toCharArray());
            TrustManager[] tm = {new MyX509TrustManager()};
            SSLContext sslContext = SSLContext.getInstance("TLSv1");
            sslContext.init(kmf.getKeyManagers(), tm, new java.security.SecureRandom());
            SSLConnectionSocketFactory sslsf = new SSLConnectionSocketFactory(sslContext);
            client = HttpClients.custom().setSSLSocketFactory(sslsf).build();

            httpPost = new HttpPost(httpurl);
            httpPost.setEntity(new StringEntity(strxml, "utf-8"));

            CloseableHttpResponse response = client.execute(httpPost);
            StatusLine statusLine = response.getStatusLine();
            HttpEntity entity = response.getEntity();
            if (statusLine.getStatusCode() == 200) {
                return EntityUtils.toString(entity, "utf-8");
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        } finally {
            if (client != null) {
                client.close();
            }
        }
        return null;
    }
}
```

在上面的代码中，读取了项目目录下的`pkcs12`证书文件，但是微信在官方文档中更加推荐不要将证书放在web服务器的虚拟目录下，通过放在有权限控制的目录中，防止被他人下载。

## 2、接收同步返回结果

在发送完携带证书的http请求后，同步返回结果格式如下所示，接收到下面的信息后可以根据业务需求存入数据库中进行备案：

```xml
<xml>
   <return_code><![CDATA[SUCCESS]]></return_code>
   <return_msg><![CDATA[OK]]></return_msg>
   <appid><![CDATA[wx2421b1c4370ec43b]]></appid>
   <mch_id><![CDATA[10000100]]></mch_id>
   <nonce_str><![CDATA[NfsMFbUFpdbEhPXP]]></nonce_str>
   <sign><![CDATA[B7274EB9F8925EB93100DD2085FA56C0]]></sign>
   <result_code><![CDATA[SUCCESS]]></result_code>
   <transaction_id><![CDATA[1008450740201411110005820873]]></transaction_id>
   <out_trade_no><![CDATA[1415757673]]></out_trade_no>
   <out_refund_no><![CDATA[1415701182]]></out_refund_no>
   <refund_id><![CDATA[2008450740201411110000174436]]></refund_id>
   <refund_channel><![CDATA[]]></refund_channel>
   <refund_fee>1</refund_fee>
</xml>
```

注意返回结果中的`return_code`为`SUCCESS`时，只表示退款申请被微信服务器接收成功，并不是退款执行成功，退款的结果会在回调接口中被返回。

## 3、接收异步通知结果

在退款执行成功或因某种原因执行失败后，微信会调用之前在发起请求时我们填写的回调接口地址，会把退款的结果以异步通知的形式发送给我们：

```java
@PostMapping("refundFallBack")
public void refundFallBack(HttpServletRequest request,HttpServletResponse response) throws IOException {
    StringBuilder sb = new StringBuilder();
    BufferedReader reader = null;
    try (InputStream inputStream = request.getInputStream()) {
        reader = new BufferedReader(new InputStreamReader(inputStream, Charset.forName("UTF-8")));
        String line = "";
        while ((line = reader.readLine()) != null) {
            sb.append(line);
        }
    } catch (IOException e) {
        log.error("getBodyString错误！");
    } finally {
        if (reader != null) {
            try {
                reader.close();
            } catch (IOException e) {
                log.error(ExceptionUtils.getMessage(e));
            }
        }
    }
    
    String resultXml;
    String bodyXml = sb.toString();
    Map<String, String> xmlResult = XmlUtil.parseXmlToMap(bodyXml);
    if ("SUCCESS".equals(xmlResult.get("return_code"))) {
        String reqInfo = xmlResult.get("req_info");
        byte[] decode = Base64.decode(reqInfo);
        String md5Hash = Md5Utils.hash(WechatConstants.muchSecret);
        try {
            //AES解密
            String result = AESUtils.decryptData(decode, md5Hash);
            Map<String, String> resultMap = XmlUtil.parseXmlToMap(result);
            //执行业务逻辑...
            } catch (Exception e) {
              log.error(e.getMessage());
            }
        resultXml=WechatConstants.FALLBACK_SUCCESS_XML;
    }else{
        resultXml= WechatConstants.FALLBACK_FAIL_XML;
    }
    ServletOutputStream outputStream = response.getOutputStream();
    outputStream.println(resultXml);
    outputStream.close();
}
```

可以看出，异步返回通知并不能够被直接拿来解析使用，在使用过程中还进行了一次解密，这是因为返回的报文格式如下：

```xml
<xml>
<return_code>SUCCESS</return_code>
   <appid><![CDATA[wx2421b1c4370ec43b]]></appid>
   <mch_id><![CDATA[10000100]]></mch_id>
   <nonce_str><![CDATA[TeqClE3i0mvn3DrK]]></nonce_str>
   <req_info><![CDATA[T87GAHG17TGAHG1TGHAHAHA1Y1CIOA9UGJH1GAHV871HAGAGQYQQPOOJMXNBCXBVNMNMAJAA]]></req_info>
</xml>
```

其中`req_info`为加密信息，需要对其进行解密，解密步骤如下：

- 对加密串A做`base64`解码，得到加密串B
- 对商户key做`md5`加密，得到32位小写`key*`
- 用`key*`对加密串B做`AES-256-ECB`解密

`AES`解密工具类实现如下：

```java
public class AESUtils {
    public static String decryptData(byte[] base64Data,String md5Hash) throws Exception {
        Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
        //加解密算法/工作模式/填充方式
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS7Padding");
        SecretKeySpec key = new SecretKeySpec(md5Hash.toLowerCase().getBytes(), "AES");
        cipher.init(Cipher.DECRYPT_MODE, key);
        return new String(cipher.doFinal(base64Data), "UTF-8");
    }
}
```

解密完成后，得到真正包含退款信息的xml报文：

 ```xml
<root>
  <out_refund_no><![CDATA[131811191610442717309]]></out_refund_no>
  <out_trade_no><![CDATA[71106718111915575302817]]></out_trade_no>
  <refund_account><![CDATA[REFUND_SOURCE_RECHARGE_FUNDS]]></refund_account>
  <refund_fee><![CDATA[3960]]></refund_fee>
  <refund_id><![CDATA[50000408942018111907145868882]]></refund_id>
  <refund_recv_accout><![CDATA[支付用户零钱]]></refund_recv_accout>
  <refund_request_source><![CDATA[API]]></refund_request_source>
  <refund_status><![CDATA[SUCCESS]]></refund_status>
  <settlement_refund_fee><![CDATA[3960]]></settlement_refund_fee>
  <settlement_total_fee><![CDATA[3960]]></settlement_total_fee>
  <success_time><![CDATA[2018-11-19 16:24:13]]></success_time>
  <total_fee><![CDATA[3960]]></total_fee>
  <transaction_id><![CDATA[4200000215201811190261405420]]></transaction_id>
</root>
 ```

再对上面的报文进行解析，执行业务系统中对退款流程的后续处理即可。同样，我们需要按照微信规定的格式返回接收成功的报文，并在每次处理前验证通知消息的幂等性。

在退款中还踩到了一个坑，如果在微信的商户平台中，开启了自动提现功能，那么会自动将基本账户内的资金全提现至结算银行卡中，隔日到账。这样如果被结算过的订单在被退款时商户平台也没有基本余额，就会报错提示“基本余额不足，请充值后重新发起退款”，所以最好先关闭自动提现，待订单超过退款周期后再对其进行结算，避免发起退款不成功的情况。