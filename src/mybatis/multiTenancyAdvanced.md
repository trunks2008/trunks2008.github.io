---
title: Mybatis-plus多租户实战进阶
icon: page
order: 5
author: Hydra
date: 2020-12-20
tag:
  - Mybatis-plus
  - 多租户
star: true
---



<!-- more -->

在基于Mybatis-plus实现多租户架构中，介绍了在多租户项目中如果要开启一个子线程，那么需要手动进行`RequestAttributes`的子线程共享。如果应用场景较少的话可能也不是特复杂，但是如果场景数量上来了，还是很容易忘记的，在测试的时候才会发现疏忽了这一块。所以想了半天，决定抽取一个公共方法，用来执行这些特定的子线程。

既然要复用这类线程的执行方式，线程池是个不错的选择。这里省略创建线程池的步骤，选择直接使用spring内已经初始化好的线程池`ThreadPoolTaskExecutor`。下面写一个工具类，通过线程池启动子线程，实现下面几个内容：

- 使用线程池启动子线程前获取当前的`RequestAttributes`
- 在子线程中开启`RequestAttributes`的继承
- 测试在子线程中能否拿到`Request`中的租户信息

```java
@Component
public class AsyncExecutorUtil {
    @Autowired
    ThreadPoolTaskExecutor threadPoolTaskExecutor;

    public void doMethodWithRequest() {
        ServletRequestAttributes sra = (ServletRequestAttributes) 
              RequestContextHolder.getRequestAttributes();
        threadPoolTaskExecutor.execute(()->{
            RequestContextHolder.setRequestAttributes(sra, true);
            System.out.println(sra.getRequest().getHeader("tenantId"));
        });
    }
}
```

使用postman进行测试，发现这样做确实可以实现`Request`的传递，那么下一个问题就来了，我怎么把要执行的方法逻辑传递给这个线程呢？可能每次要实际执行的逻辑都不一样，所以这里使用函数式接口来传递具体方法的实现：

```java
@FunctionalInterface
public interface FunctionInterface {
    void doMethod();
}
```

修改线程池的执行方法，首先保存当前`RequestAttributes`，在启动的子线程中实现对`Request`的继承，最后执行函数式接口的方法：

```java
public void doMethodWithRequest(FunctionInterface  functionInterface) {
    ServletRequestAttributes sra = (ServletRequestAttributes) 
                    RequestContextHolder.getRequestAttributes();
    threadPoolTaskExecutor.execute(()->{
        RequestContextHolder.setRequestAttributes(sra, true);
        System.out.println(sra.getRequest().getHeader("tenantId"));
        functionInterface.doMethod();
    });
}
```

在web请求中，在函数式接口中实现实际执行的逻辑，这里为了使结构更清楚一些没有使用lambda表达式，如果使用lambda表达式可以使这一段代码更加简洁。之后使用上面定义的异步线程工具类在子线程中执行数据库的查询：

```java
@RestController
public class TestController {
    @Autowired
    AsyncExecutorUtil executorUtil;

    @GetMapping("users")
    public void user() {
        executorUtil.doMethodWithRequest(new FunctionInterface() {
            @Override
            public void doMethod() {
                List<User> userList = userService.getUserList();
                log.info(userList.toString());
            }
        });
    }
}
```

查看执行结果，可以正常执行：

```java
[User(id=2, name=trunks, phone=13788886666, address=beijing, tenantId=2)]
```

到这为止，不知道大家是不是记得之前提过的一个场景，有些时候第三方的系统在调用我们的接口时可能无法携带租户信息，之后的所有数据库查询都需要我们使用重新手写sql，并添加`SqlParse`的过滤。

举个例子，我们系统中创建订单，调用微信支付，在前端支付成功后微信会回调我们的接口。这个时候微信是肯定不会携带租户的信息的，按照之前的做法，我们就需要先根据回调信息的订单号先使用过滤过的sql语句查出这笔订单的信息，拿到订单中包含的租户id，在之后所有被过滤掉的手写sql中手动拼接这个租户id。

但是有了上面的结果 ，对我们执行这类的请求可以产生一些改变 。之前我们是向子线程传递真实的原始Request，但是当前的`Request`请求不满足我们的需求，没有包含租户信息，那么重新构建一个符合我们需求的`Request`，并传递给子线程，那么是不是就不用去进行sql的过滤和重写了呢？

按照上面的步骤，先进行第一步，手写一个过滤租户的sql：

```java
public interface OrderMapper extends BaseMapper<Order> {
    @SqlParser(filter = true)
    @Select("select * from `order` where order_number= #{orderNumber}")
    Order selectWithoutTenant(String orderNumber);
}
```

根据这个请求，能够查询出订单的全部信息，这里面就包含了租户的id：

```
Order(id=3, orderNumber=6be2e3e10493454781a8c334275f126a, money=100.0, tenantId=3)
```

接下来重头戏来了，既然拿到了租户id，我们就来重新伪造一个`Request`，让这个新的`Request`中携带租户id，并使用这个`Request`执行后续的逻辑。

```java
@AllArgsConstructor
public class FakeTenantRequest {
    private String tenantId;

    public ServletRequestAttributes getFakeRequest(){
        HttpServletRequest request = new HttpServletRequest() {
            @Override
            public String getHeader(String name) {
                if (name.equals("tenantId")){
                    return tenantId;
                }
                return null;
            }

           //...这里省略了其他需要重写的方法，不重要，可不用重写
        };

        ServletRequestAttributes servletRequestAttributes=new ServletRequestAttributes(request);
        return servletRequestAttributes;
    }
}
```

构造一个`HttpServletRequest`的过程比较复杂，里面需要重写的方法非常多，好在我们暂时都用不上所以不用重写，只重写对我们比较重要的`getHeader`方法即可。我们在构造方法中传进来租户id，并把这个租户id放在`Request`的请求头的`tenantId`字段，最终返回`RequestAttributes`。

在线程池工具类中添加一个方法，在子线程中使用我们伪造的`RequestAttributes`：

```java
public void doMethodWithFakeRequest(ServletRequestAttributes fakeRequest, 
        FunctionInterface functionInterface) {
    threadPoolTaskExecutor.execute(() -> {
        RequestContextHolder.setRequestAttributes(fakeRequest, true);
        functionInterface.doMethod();
    });
}
```

模拟回调请求，这时候在请求的`Header`中不需要携带任何租户信息：

```java
@GetMapping("callback")
public void callBack(String orderNumber){
    Order order = orderMapper.selectWithoutTenant(orderNumber);
    log.info(order.toString());
    FakeTenantRequest fakeTenantRequest=new FakeTenantRequest(order.getTenantId().toString());
    executorUtil.doMethodWithFakeRequest(fakeTenantRequest.getFakeRequest(),new FunctionInterface() {
        @Override
        public void doMethod() {
            List<User> userList = userService.getUserList();
            log.info(userList.toString());
        }
    });
}
```

查看执行结果：

```java
 - ==>  Preparing: select * from `order` where order_number= ? 
 - ==> Parameters: 6be2e3e10493454781a8c334275f126a(String)
 - <==      Total: 1
 - Order(id=3, orderNumber=6be2e3e10493454781a8c334275f126a, money=100.0, tenantId=3)
 - ==>  Preparing: SELECT id, name, phone, address, tenant_id FROM user WHERE (id IS NOT NULL) AND tenant_id = '3' 
 - ==> Parameters: 
 - <==      Total: 1
 - [User(id=1, name=hydra, phone=13699990000, address=qingdao, tenantId=3)]
```

在子线程中执行的sql会经过mybatis-plus的租户过滤器，在sql中添加租户id条件。这样，就实现了通过伪造`Request`的方式极大程度的简化了改造sql的过程。