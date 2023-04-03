---
title: 微服务中，如何优化接口调用
icon: page
order: 8
author: Hydra
date: 2021-05-17
tag:
  - 服务调用
star: true
---



<!-- more -->

在微服务的设计中，我们通常考虑到的是通过加密、熔断、限流等操作保证接口的安全性、健壮性等问题，但是在代码的编写中，你考虑过优化接口的调用方式吗？下面我们就来看一看，如何更优雅的调用接口。

假设在我们的系统中现在有两个微服务，订单服务和库存服务，业务流程是当使用订单服务创建订单时，先调用库存服务查询是否有库存，如果有库存才能完成订单的下单操作。

先从简单入手，以使用RestTemplate进行服务间调用为例。定义库存服务及其提供的对外调用接口：

```java
@Service
public class StockService {
    public Integer query(String id){
        return 10;
    }
}

@RestController
public class StockController {
    @Autowired
    StockService stockService;
    @PostMapping("/query")
    public Integer queryStock(String id){
        return stockService.query(id);
    }
}
```

再定义订单服务及其提供的对外调用接口，在订单服务中，使用RestTemplate调用库存服务：

```java
@Service
public class OrderService {
    @Autowired
    private RestTemplate restTemplate;
    public String createOrder(String id){
        Integer stock = restTemplate.postForObject("http://stockService/query", id, Integer.class);
        System.out.println(stock);
        return "create success";
    }
}

@RestController
public class OrderController {
    @Autowired
    OrderService orderService;
    @GetMapping("/create")
    public String createOrder(@RequestParam String id){
        return orderService.createOrder(id);
    }
}
```

这样写可以正常进行调用并返回结果，但存在一些的问题：

- 在使用RestTemplate 进行服务间调用使用的是字符串，如果调用的路径填写错误，编译器在编译的时候不会进行提示，只有在真正调用服务时才会发现错误
- 如果在订单服务中使用了多次库存服务，那么这个库存服务的接口地址就会出现多次，如果后期维护中接口的路径发生变化，那么需要修改所有出现调用的地方

针对这两个问题，如果将调用路径单独封装成常量，那么在调用的时候直接引用这个常量，可以避免字符串出现错误，并且在后续的修改中，只修改一个地方就可以了。在订单服务中创建一个类来维护接口字符串：

```java
public class StockURL{
    public static final String PREFIX="http://stockService";
    public static final String STOCK_QUERY="/query";
}
```

并将调用改为：

```java
public String createOrder(String id){
    Integer stock = restTemplate.postForObject(StockURL.PREFIX+StockURL.STOCK_QUERY, id, Integer.class);
    System.out.println(stock);
    return "create success";
}
```

这样做的确可以一定程度规避接口名称错误带来的风险，但是回头一看，这个接口名在库存服务中同样也可以被直接用到，也就是说如果直接由服务的提供方来维护接口名的话，是不是更好一些呢？

为了让这个常量在两个微服务中同时被调用，可以单独创建一个Module来维护它，将这个Module命名为`stock-api`，并将之前创建的`StockURL`类直接复制过来。在订单服务和库存服务的pom文件中引入我们创建的模块依赖：

```xml
<dependency>
  <groupId>com.cn.hydra</groupId>
  <artifactId>stock-api</artifactId>
  <version>1.0-SNAPSHOT</version>
</dependency>
```

订单服务维持原样不动，库存服务可以修改接口：

```java
@PostMapping(StockURL.STOCK_QUERY)
public Integer queryStock(String id){
    return stockService.query(id);
}
```

这样，由库存服务的提供者来维护`stock-api`模块，只需要修改常量就可以做到只需要修改一次，其他地方不再需要修改。

那么，是否还存在其他问题呢？仔细看一下发起请求调用：

```java
restTemplate.postForObject(StockURL.PREFIX+ StockURL.STOCK_QUERY, id, Integer.class);
```

RestTemplate 发送请求时的参数和返回类型由发起调用方指明，那么这样仍然存在风险。虽然在微服务调用间一般都会提供比较详细的接口文档说明，但是如果接口发生变更但文档没有及时更新，那么仍然可能发生调用时的错误。同样，这样的错误是编译器不会提醒，只有在调用时才会被发现的

那么，如果在调用远程方法时，希望能够像调用本地方法一样，给出参数和返回值的提示，不符合要求时能够及时报错，那么就要继续改造，由服务提供方进行接口的维护。

我们把`OrderService`类拿到`stock-api`模块中加以改造，库存服务提供者来维护这个接口：

```java
@Service
@ConditionalOnBean(RestTemplate.class)
public class StockServiceApi {
    @Autowired
    private RestTemplate restTemplate;
    public Integer query(String id){
        Integer stock = restTemplate.postForObject(StockURL.PREFIX+ StockURL.STOCK_QUERY, id, Integer.class);
        return stock;
    }
}
```

需要注意，这样提供的Service在订单服务中是无法通过`@Autowired`被直接注入的，因为Springboot的自动扫描是扫描不到这个Bean的，如果我们不希望再通过`@Bean`的方式手动注入的话，那么我们可以模仿`starter`的方式，来将这个Bean注入到容器中，在`stock-api`模块的最外层定义一个`Configuration`类进行扫描：

```java
@Configuration
@ComponentScan
public class Config {
}
```

创建`META-INF/spring.factories`：

```properties
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\com.cn.Config
```

在订单服务中重写方法调用，现在就可以直接调用接口，省去了还要翻阅接口文档看RestTemplate 调用需要判断参数和返回值的麻烦了：

 ```java
@RestController
public class OrderController2 {
    @Autowired
    StockServiceApi stockServiceApi;
    @GetMapping("/create2")
    public String createOrder(@RequestParam String id){
        Integer stock = stockServiceApi.query(id);
        System.out.println(stock);
        return "create success";
    }
}
 ```

改造到这个程度，可以看到服务调用者的工作被大幅度简化了，但是服务提供者同时要对外提供`Controller`和`ServicApi`两者，增添了一定的工作量。并且，`Controller`和`Service`的数量应该是一一对应的。那么为了更稳定的维护这个对应关系，其实可以创建一个接口来实现绑定：

```java
public interface IStockService {
    Integer query(String id);
}
```

再分别让`Controller`和`Service`实现这个接口：

```java
public class StockServiceApi implements IStockService{...
```

```java
public class StockController implements IStockService {...
```

这样当修改接口时，就会提示我们去修改所有的实现类。

到这，对接口调用的优化进行一下总结：

- 通过定义字符串常量避免接口地址调用出错
- 服务提供方同时提供接口及接口的Api调用，消灭服务调用者调用时参数及返回值的潜在错误
- 服务提供方通过接口的方式绑定Controller和Api

讨论完使用RestTemplate的调用方式，接下来看一下使用`Feign`调用时，应该如何优化接口调用。

先看一下正常方式下，订单服务使用Feign调用库存服务：

```java
@FeignClient("stockService")
public interface IFeignOrderService {
    @PostMapping("/query")
    Integer query(String id);
}
```

我们知道，Feign中调用的接口路径和服务提供方的接口路径是一致的，那么也可以通过提供公共接口的方式进行优化。在`stock-api`模块中添加一个接口：

```java
public interface IFeignStockService {
    @PostMapping("/query")
    Integer query(String id);
}
```

修改服务提供方的Controller类实现该接口，方法上不再需要加`@PostMapping`注解，会自动继承：

```java
@RestController
public class FeignStockController implements IFeignStockService {
    @Autowired
    StockService stockService;
    @Override
    public Integer query(String id) {
        return stockService.query(id);
    }
}
```

修改服务调用方接口，同样继承`stock-api`模块中的接口，写一个空接口即可：

```java
@FeignClient("stockService")
public interface IFeignOrderService extends IFeignStockService {
}
```

在使用Feign的情况下，本身就通过声明式的服务调用简化了接口的使用过程，通过上述的这一种方式，能够进而通过api模块完成了服务调用的优化，保证了代码的易维护性与稳定性。