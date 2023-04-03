---
title: 如何优雅地使用Token？
icon: page
order: 3
author: Hydra
date: 2020-11-01
tag:
  - JWT
  - token
star: true
---



<!-- more -->

最近在工作中，有这么一个场景用到了JWT签发和验证token，只是单纯的使用JWT，也没有使用`SpringSecurity`和`Shiro`什么的进行整合，没想到一个简单的功能前前后后一周改了四五遍，可以说经历了不断的优化，来一起看看修改的历程吧。

## 1.0版本

最初的版本是这样处理的，在Controller层的接口里传入`HttpServletRequest`参数：

```java
@RestController
@RequestMapping("api")
public class TestController {
    @Autowired
    MyService myService;

    @GetMapping("test")
    public String test(HttpServletRequest request){
        String result = myService.test(request);
        return result;
    }
}
```

为了简单明了，这里省略了Service的接口层，直接调用Service层的方法：

```java
@Service
public class MyService {
    public String test(HttpServletRequest request){
        String token = request.getHeader("token");
        System.out.println(token);
        //验证token，处理业务逻辑
        return "success";
    }
}
```

在方法中通过`HttpServletReques`t获取头信息中的token，然后进行验证，之后再做业务逻辑处理。乍一看没什么问题，但是写多了就觉得这么写很麻烦，每个接口都要多这么一个不必要的参数，能不能处理一下呢？

## 2.0版本

这时候想起来了，以前学Spring的时候不就说过吗，处理这种和业务无关的大量重复劳动，放在切面里不就好了吗。但回头一想，Service里的方法也不是每个都需要验证token，干脆写个注解，用切面来处理加了注解的方法。

定义一个注解，名字叫`NeedToken`，也不需要什么属性，简单易懂：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface NeedToken {
}
```

切面要做的很简单，通过SpringMvc提供的`RequestContextHolder`获取当前的`HttpServletRequest`请求，然后再取出`header`中的token。

这时候第一个问题来了，**我在切面获取到了token以后，怎么传递给Service中调用的方法呢？**

回想到在切面中可以获取方法的参数，然后动态修改参数的值就可以了。修改Service方法的参数，去掉烦人的`HttpServletRequest`，添加一个`String`s类型的参数，用于接收token。

```java
@Service
public class MyService {
    @NeedToken
    public String test(String token){
        System.out.println(token);
        //验证token，处理业务逻辑
        return "success";
    }
}
```

切面实现如下：

```java
@Aspect
@Component
public class TokenAspect {
    @Pointcut("@annotation(com.cn.hydra.aspectdemo.annotation.NeedToken)")
    public void tokenPointCut() {
    }

    @Around("tokenPointCut()")
    public Object doAround(ProceedingJoinPoint point) throws Throwable {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes.getRequest();
        String token = request.getHeader("token");

        Object[] args = point.getArgs();
        Signature signature = point.getSignature();
        MethodSignature methodSignature = (MethodSignature) signature;
        String[] paramName = methodSignature.getParameterNames();
        List<String> paramNameList = Arrays.asList(paramName);
        if (paramNameList.contains("token")){
            int pos = paramNameList.indexOf("token");
            args[pos]=token;
        }

        Object object = point.proceed(args);
        return object;
    }
}
```

切面中做了下面几件事：

- 定义切点，在加了`@NeedToken`注解的方法织入逻辑
- 通过`RequestContextHolder`获取`HttpServletRequest` ，获取header中的token
- 通过`MethodSignature` 获取方法的参数列表，修改参数列表中的token的值
- 使用新的参数列表调用原方法，这时候就把token传递给了方法


顺带修改一下Controller的方法，这时候就已经不需要传入`HttpServletRequest` 了，但是因为要调用Service的方法，并且方法中有一个参数token，这里可以随意传一个值，暂且传了个null：

```java
@RestController
@RequestMapping("api")
public class TestController {
    @Autowired
    MyService myService;
    
    @GetMapping("test")
    public String test(){
        String result = myService.test(null);
        return result;
    }
}
```

写到这里，虽然说能解决问题，但是要多写一个null的参数，就让人就很难受了，作为强迫症必须想办法把它干掉。


## 3.0版本

那么如果不通过传递参数的方式，有什么办法能把token传递给方法呢？这里灵机一动，可以通过切面获取方法属于的对象啊，有了对象就好办了，直接通过反射给某个属性注入值。再次修改Service，声明一个全局变量，用于反射注入token使用。

```java
@Service
public class MyService{
    private String TOKEN;
    
    @NeedToken
    public String test() {
        System.out.println(TOKEN);
        //验证token，处理业务逻辑
        return  TOKEN;
    }
}
```

修改切面实现方法：

```java
@Around("tokenPointCut()")
public Object doAround(ProceedingJoinPoint point) throws Throwable {
    try {
        ServletRequestAttributes attributes=(ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes.getRequest();
        String token = request.getHeader("token");

        Field tokenField = point.getTarget().getClass().getDeclaredField("TOKEN");
        tokenField.setAccessible(true);
        tokenField.set(point.getTarget(),token);

        Object object = point.proceed();
        return object;
    } catch (Throwable e) {
        e.printStackTrace();
        throw e;
    }
}
```

注意这里不再去修改方法传入的参数，而是通过获取类的Field ，然后向当前对象的token对应的`Field`注入实际值来实现的。

写到这自我感觉良好了一会，但是写了几个类发现了我每个Service类都得多声明一个`String`类型的token全局变量啊，不光是麻烦，万一哪个类忘了写不就直接gg了，有没有什么更简便、安全的方法呢？

## 4.0版本

所以说**偷懒**和**摸鱼**的愿景真的是推动社会进步的一大原动力，左思右想后干脆写一个父类，把token声明在父类里，然后每个Service作为子类来继承他，这样就不会忘记了，并且代码也干净了很多。


先定义一个父类，至于为什么使用父类而不是接口，原因就是接口中声明的变量是默认被`final`修饰的，所以是不能被改变的。

```java
public class BaseService {
    public String TOKEN = null;
}
```

修改Service代码，继承`BaseService`类，删掉自己的`TOKEN`变量：

```java
@Service
public class MyService extends BaseService {
    @NeedToken
    public String test() {
        System.out.println(TOKEN);
        //验证token，处理业务逻辑
        return  TOKEN;
    }
}
```

调用一下接口测试，结果抛出异常：

```
java.lang.NoSuchFieldException: TOKEN
  at java.lang.Class.getDeclaredField(Class.java:2070)
  at com.cn.hydra.aspectdemo.aspect.TokenAspect.doAround(TokenAspect.java:35)
  ...
```

分析了一下，看样子是反射的时候不能通过当前对象拿到父类中定义的变量，那我们就简单修改一下切面的代码：

```java
@Around("tokenPointCut()")
public Object doAround(ProceedingJoinPoint point) throws Throwable {
    try {
        ServletRequestAttributes attributes=(ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes.getRequest();
        String token = request.getHeader("token");

        //Field tokenField = point.getTarget().getClass().getDeclaredField("TOKEN");
        Class<?> baseClazz = point.getTarget().getClass().getSuperclass();
        Field tokenField = baseClazz.getDeclaredField("TOKEN");
        tokenField.setAccessible(true);
        tokenField.set(point.getTarget(),token);

        Object object = point.proceed();
        return object;
    } catch (Throwable e) {
        e.printStackTrace();
        throw e;
    }
}
```

修改为通过当前对象获取父类，然后获取父类中的变量，再通过反射注入token值。

测试了几遍token获取都没啥问题，简直美滋滋。但是隔了一天突然发现不对啊，众所周知Spring的默认情况下Bean都是单例模式，并且全局变量的值任何一个线程都可能去改变。那么就存在情况，可能一个线程会拿到另一个线程修改后的token。修改的方法倒也不是没有，但是为了个token我再把Bean的作用域改为`prototype`或者`request`，岂不是得不偿失。


想到这里，立马着手验证一下拿到的token是否是自己的，在Service中添加一个方法，方法有一个参数name表明用户身份，一会要拿来和token进行比对：

```java
@Service
public class MyService extends BaseService {
    @NeedToken
    public boolean checkToken(String name) {
        System.out.println(name+"  "+TOKEN  +" "+ name.equals(TOKEN));
        return  name.equals(TOKEN);
    }
}
```

使用`CyclicBarrier`测试200个并发请求，注意这里不要使用postman进行测试，因为说到底postman的`runner`执行请求的时候还是串行的。所以说如果对`JMeter`什么的工具不太熟悉的话，还是用`CyclicBarrier`比较简单实用。（对CyclicBarrier不熟悉的同学，可以看看以前写过的这篇[CyclicBarrier](https://juejin.cn/post/7021698679421534245)）


测试类实现如下：

```java
public class HttpSendTest {
    public static void main(String[] args) {
        CyclicBarrier barrier=new CyclicBarrier(200);
        Thread[] threads=new Thread[100];
        for (int i = 0; i <100 ; i++) {
            threads[i]=new Thread(()->{
                try {
                    barrier.awit();sendGet("http://127.0.0.1:8088/api/test2","name=hydra","hydra");
                    //barrier.await();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
            threads[i].start();
        }

        Thread[] threads2=new Thread[100];
        for (int i = 0; i <100 ; i++) {
            threads2[i]=new Thread(()->{
                try {
                    sendGet("http://127.0.0.1:8088/api/test2","name=trunks","trunks");
                    /移上barrier.await();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            });
            threads2[i].start();
        }
    }

    public static String sendGet(String url, String param, String token) {
        StringBuilder result = new StringBuilder();
        BufferedReader in = null;
        try {
            String urlNameString = url + "?" + param;
            URL realUrl = new URL(urlNameString);
            URLConnection connection = realUrl.openConnection();
            connection.setRequestProperty("accept", "*/*");
            connection.setRequestProperty("connection", "Keep-Alive");
            connection.setRequestProperty("token", token);
            connection.setRequestProperty("user-agent", "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1;SV1)");
            connection.connect();
            in = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"));
            String line;
            while ((line = in.readLine()) != null) {
                result.append(line);
            }
            System.out.println(result);
        } catch (ConnectException e) {
            e.printStackTrace();
        } catch (SocketTimeoutException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try {
                if (in != null) {
                    in.close();
                }
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
        return result.toString();
    }
}
```

测试中传给参数的name属性和请求中携带的token相同，跑一下测试用例，发现在高并发情况下，确实出现了一些不匹配的情况，说明取到的token不是自己的：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d8dfcc6a7f354f47b9d93f6e4980e669~tplv-k3u1fbpfcp-zoom-1.image)

## 5.0版本

辛辛苦苦改了几版的代码居然有这么大的问题，这可咋整啊？再回头一想，不就是要保证每个线程有自己的唯一的一份token的副本吗，这不是正好可以使用`ThreadLocal`嘛。


重新定义父类，使用`ThreadLocal`保存token：

```java
spublic class BaseService2 {
    public static ThreadLocal<String> TOKEN= 
            ThreadLocal.withInitial(() -> null);
}
```

修改Service：

```java
@Service
public class MyService2 extends BaseService2 {
    @NeedToken
    public boolean testToken(String name) {
        String token=TOKEN.get();
        boolean check = name.equals(token);
        System.out.println(name+"  "+token +"  "+check);
        return  check;
    }
}
```

修改切面：

```java
@Around("tokenPointCut()")
public Object doAround(ProceedingJoinPoint point) throws Throwable {
    try {

        ServletRequestAttributes attributes=(ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes.getRequest();
        String token = request.getHeader("token");

        Class<?> baseClazz = point.getTarget().getClass().getSuperclass();
        Field tokenField = baseClazz.getDeclaredField("TOKEN");
        ThreadLocal<String> local = (ThreadLocal<String>) tokenField.get(point.getTarget());
        local.set(token);

        tokenField.setAccessible(true);
        tokenField.set(point.getTarget(),local);

        Object object = point.proceed();
        return object;
    } catch (Throwable e) {
        e.printStackTrace();
        throw e;
    }
}
```

通过反射拿到`ThreadLocal`对象，通过`set`方法给`ThreadLocal`赋值后，再通过反射把它写回对象 。再次并发测试，即使在600个并发请求情况下，也没有出现异常情况。

优化过程到这里就暂且结束了，当然可能还有什么没想到的地方，欢迎大家给我留言讨论。