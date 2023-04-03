---
title: Sharding-Sphere实现多租户架构
icon: page
order: 6
author: Hydra
date: 2020-12-13
tag:
  - Sharding
  - 多租户
star: true
---



<!-- more -->

在之前的文章中，我们介绍过基于Mybatis-plus实现多租户，但是在实际工作中可能会存在一些不足：

1. 如果是基于现有的系统改造，那么在所有的表上都需要加租户字段，会非常复杂
2. 如果第三方系统调用我们的接口，可能无法要求他们在请求中携带租户信息，因此要重写大量的需要单独过滤的sql语句

针对上面的问题，接下来继续介绍一下基于`Sharding-Sphere`的分表来实现多租户，与之前在一张表中存放数据不同，我们会将不同租户的数据存放在同一数据库的不同表中，相对于前一种模式，这样会具有更高的数据隔离性。

首先来假设一个应用场景，某航空票务公司网站中，海航系、南航系和国航系被分为3个租户，租户间数据分表存放，它们下属的各个航空公司分别隶属于以上租户，那么随之各自的订单数据也存放在各自的租户数据表中。

首先先进行准备工作，为3个租户分别建表：

```sql
CREATE TABLE `t_order_0` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_number` varchar(32) DEFAULT NULL,
  `money` decimal(18,4) DEFAULT NULL,
  `postage` decimal(18,4) DEFAULT NULL,
  `address` varchar(128) DEFAULT NULL,
  `company` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) 
```

注意相同表结构的表需要建立三张，分别是`t_order_0`，`t_order_1`和`t_order_2`。

导入`Sharding-Sphere`依赖和数据库连接池`druid`的依赖：

```xml
<dependency>
    <groupId>org.apache.shardingsphere</groupId>
    <artifactId>sharding-jdbc-spring-boot-starter</artifactId>
    <version>4.1.1</version>
</dependency>
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid</artifactId>
    <version>1.1.22</version>
</dependency>
```

注意这里引入的是`druid`而不是`druid-spring-boot-starter`，因为在高版本的`sharding-sphere`中，如果使用`starter`版本可能报错找不到`url`的错误。

在`application.yml`中进行配置数据源及分表规则：

```yml
spring:
  shardingsphere:
    datasource:
      names: ds0
      ds0:
        type: com.alibaba.druid.pool.DruidDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        url: jdbc:mysql://localhost:3306/tenant?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC
        username: hydra
        password: 123456
    sharding:
      defaultDataSourceName: ds0
      tables:
        t_order:
          actualDataNodes: ds0.t_order_$->{0..2}
          tableStrategy:
            standard:
              shardingColumn: company
              preciseAlgorithmClassName: com.cn.hydra.shardingtest.algorithm.OrderShardingAlgorithm
    props:
      sql:
        show: true
```

对上面的参数进行说明：

- `datasource`：这里因为还用不到分库，所以只进行了一个数据源的配置，如果存在多个则与`ds0`结构相同
- `defaultDataSourceName`：选择默认数据源
- `tables`：开始数据分片规则配置，注意下面的t_order是逻辑表名称
- `actualDataNodes` ：由数据源名加表名组成，以小数点分隔，多个表以逗号分隔，支持行表达式
- `tableStrategy`：分表策略
- `standard`：用于单分片键的标准分片场景
- `shardingColumn`：分片列名称
- `preciseAlgorithmClassName`：分片算法实现类，这个类由对我们自己实现，定义分片逻辑
- `props.sql.show`：打印sql语句

创建一个枚举类，存放航空公司名称到租户id的对应关系，并写一个根据航空公司查找租户编码的方法，在后面分片规则中使用：

```java
public enum Rules {
    NANHANG(0,Arrays.asList("NANFANG","XIAMEN","CHONGQING")),
    HAIHANG(1, Arrays.asList("SHOUDU","CHANGAN","JINPENG")),
    GUOHANG(2,Arrays.asList("GUOHANG","SHENZHEN","SHANHANG"));

    public static int searchCode(String company){
        for (Rules value : Rules.values()) {
            if (value.getCompany().contains(company)){
                return value.getCode();
            }
        }
        return -1;
    }

    private int code;
    private List<String> company;

    Rules(int code,List<String> company){
        this.code=code;
        this.company=company;
    }

    public int getCode() {
        return code;
    }

    public List<String> getCompany() {
        return company;
    }
}
```

接下来是分表的核心，分片逻辑类需要实现`PreciseShardingAlgorithm`接口，并重写`doSharding`方法。之后对订单表的操作都会执行这里的`doSharding`方法选择实际执行sql的数据库表：

```java
public class OrderShardingAlgorithm implements PreciseShardingAlgorithm<String> {
    @Override
    public String doSharding(Collection<String> collection, PreciseShardingValue<String> preciseShardingValue) {

        int tenant = Rules.searchCode(preciseShardingValue.getValue());
        String targetTable="t_order_"+tenant;

        if (collection.contains(targetTable)){
            return targetTable;
        }
        throw  new UnsupportedOperationException("找不到租户："+preciseShardingValue);
    }
}
```

之前在yml中定义了分片列是`company`，因此这里通过`preciseShardingValue`能够拿到`company`的值。再根据上面枚举类的对应关系，可以获得租户id，最后返回真正执行sql的表名。

创建一个简单的订单Service进行测试，用来执行创建订单和查询订单的操作，参数都是航空公司的名称：

```java
@Service
public class OrderService {
    @Autowired
    OrderMapper orderMapper;

    public void createOrder(String company){
        Order order=new Order();
        order.setOrderNumber(UUID.randomUUID().toString().replaceAll("-",""));
        order.setMoney(new BigDecimal(100));
        order.setCompany(company);
        orderMapper.insert(order);
    }

    public void getOrder(String company){
        List<Order> orders = orderMapper.selectList(new LambdaQueryWrapper<Order>().eq(Order::getCompany, company));
        orders.stream().forEach(System.out::println);
    }

}
```

首先调用创建订单方法进行测试，发送一个请求：

```http
http://127.0.0.1:8083/create?company=SHOUDU
```

查看执行结果的日志打印情况，被分为逻辑sql和实际执行的sql两部分。在逻辑sql语句中，可以看到使用的是逻辑表`t_order`，在实际sql中实际执行在`t_order_1`中，因为航空公司名称参数SHOUDU对应的租户编码是1，在分片算法中进行了实际表名的计算。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0243f96ff3f541a7adbf20cf9d73fe86~tplv-k3u1fbpfcp-zoom-1.image)

将参数换成SHENZHEN再执行一次：

```http
http://127.0.0.1:8083/create?company=SHENZHEN
```

查看执行结果，实际执行的sql语句的表被换成了`t_order_2`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/875fc88178bd483198aedc53cfe6190c~tplv-k3u1fbpfcp-zoom-1.image)

接下来看一下可能发生的特殊情况，首先，如果传递的分片列的参数不在我们定义的映射规则内，那么会抛出`UnsupportedOperationException`异常：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bee90ca9b48d41b48d5e2922504e0fe2~tplv-k3u1fbpfcp-zoom-1.image)

如果在sql中没有涉及到分片列，那么数据会被插入到所有的表中，可以看到在下面的情况中，同一个订单被同时插入到了3张表中：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/40f79a75e49b4b74895b5f7673a1055e~tplv-k3u1fbpfcp-zoom-1.image)

执行查询订单的方法进行测试：

```http
http://127.0.0.1:8083/list?company=SHENZHEN
```

同样根据分片规则在表`t_order_2`中进行了实际的查询操作：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4e558e00d3ec4e69ad4cc5f2dc4c6a8c~tplv-k3u1fbpfcp-zoom-1.image)

通过上面的实验，可以看出`Sharding-Sphere`的配置比较简单，在使用起来也是很方便的，通过客户端分片技术，能够很简单的实现基于分表的多租户需求。