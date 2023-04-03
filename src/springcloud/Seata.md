---
title: Seata搭建与分布式事务入门
icon: page
order: 6
author: Hydra
date: 2021-01-31
tag:
  - Spring Cloud Alibaba
  - Seata
star: true
---



<!-- more -->

在单体架构下，我们大多使用的是单体数据库，通过数据库的ACID特性支持，实现了本地事务。但是在微服务架构下复杂的业务关系中，分布式事务是不可避免的问题之一。Seata是Spring Cloud Alibaba分布式事务解决方案中间件，解决了微服务场景下面临的分布式事务问题。本文介绍如何通过搭建Seata环境，并通过其AT模式，实现分布式事务。

本文中使用的环境版本：

>nacos-server-1.3.1
>seata-server-1.4.0
>spring-cloud Hoxton.SR3
>spring-cloud-alibaba 2.2.1.RELEASE

##### 1、Seata服务安装包下载

下载seata-server-1.4.0：
`https://github.com/seata/seata/releases/tag/v1.4.0`
同时下载seata-server-0.0.9，需要其中的配置文件和脚本：
`https://github.com/seata/seata/releases/tag/v0.9.0`


##### 2、Seata服务配置

在conf目录下，先把配置文件备份后再进行更改

- 修改file.conf，mode选择数据库模式，并配置数据库连接信息

```shell
  ## store mode: file、db、redis
  mode = "db"
  ## database store property
  db {
    ## the implement of javax.sql.DataSource, such as DruidDataSource(druid)/BasicDataSource(dbcp)/HikariDataSource(hikari) etc.
    datasource = "druid"
    ## mysql/oracle/postgresql/h2/oceanbase etc.
    dbType = "mysql"
    driverClassName = "com.mysql.jdbc.Driver"
    url = "jdbc:mysql://127.0.0.1:3306/seata"
    user = "hydra"
    password = "123456"
    minConn = 5
    maxConn = 100
    globalTable = "global_table"
    branchTable = "branch_table"
    lockTable = "lock_table"
    queryLimit = 100
    maxWait = 5000
  }
```

- 修改registry.conf，使用nacos作为注册和配置中心。可以在nacos中创建一个命名空间，把生成的命名空间的值拷过来

```shell
  registry {
  # file 、nacos 、eureka、redis、zk、consul、etcd3、sofa
  type = "nacos"
  
    nacos {
    application = "seata-server"
    serverAddr = "127.0.0.1:8848"
    group = "SEATA_GROUP"
    namespace = "202274f4-218e-42bf-9251-e996df6340f8"
    cluster = "default"
    username = "nacos"
    password = "nacos"
  }
  
  
  config {
  # file、nacos 、apollo、zk、consul、etcd3
  type = "nacos"

  nacos {
    serverAddr = "127.0.0.1:8848"
    namespace = "202274f4-218e-42bf-9251-e996df6340f8"
    group = "SEATA_GROUP"
    username = "nacos"
    password = "nacos"
  }
```

##### 3、导入Seate参数配置到nacos配置中心

首先，把seata-server-0.9的 nacos-config.txt 和nacos-config.sh脚本拷贝到1.4版本的 seata/conf下。我们需要把nacos-config.txt的参数通过脚本nacos-config.sh导入到nacos配置中心，之后微服务项目也从nacos配置中心读取配置。这样就不用像老版本那样，需要把两个配置文件拷到微服务项目的resourcce目录下了。

修改nacos-config.txt，首先修改数据库配置：

```properties
store.mode=db
store.db.url=jdbc:mysql://127.0.0.1:3306/seata?useUnicode=true
store.db.user=hydra
store.db.password=123456
```

0.9中的参数格式还是使用横线模式，在1.4中规范有所变动，需要把横线变成驼峰，启动需要改动的参数有：

```properties
store.db.db-type=mysql
store.db.driver-class-name=com.mysql.jdbc.Driver
```

需要改成驼峰：

```properties
store.db.dbType=mysql
store.db.driverClassName=com.mysql.jdbc.Driver
```

并且，如果使用的是mysql8.0以上的版本，需要改一下驱动的名称。

其他参数的具体意义可以查看官方文档： `https://seata.io/zh-cn/docs/user/configurations.html`，并按照上面的规则进行修改。额外需要注意参数的参数是： `service.vgroup_mapping`

```properties
service.vgroup_mapping.my_test_tx_group=default
```

官方解释为事务群组，具体使用多少个事务群体没有明确指出。但通过查看文档和部分开源项目发现，大多都采用将key值设置为服务端的服务名，有多少个微服务就添加多少行。在接下来的demo中要使用两个微服务作为示例，因此添加：

```properties
service.vgroupMapping.order-service-group=default
service.vgroupMapping.stock-service-group=default
```

使用gitbash运行nacos-config.sh脚本，参数是nacos的ip：

```sh
sh nacos-config.sh 127.0.0.1
```

这样执行完成后参数默认是存在nacos config的public命名空间下，可以在nacos创建一个seata的命名空间，把所有参数拷贝过去，方便进行区分。


##### 4、建表

在seata数据库中新建表`branch_table`,` global_table`,` lock_table`，在业务数据库中新建表`undo_log`，用于回滚，这些脚本在seata-server-0.9中也可以直接找到。

```sql
-- the table to store GlobalSession data
drop table if exists `global_table`;
create table `global_table` (
  `xid` varchar(128)  not null,
  `transaction_id` bigint,
  `status` tinyint not null,
  `application_id` varchar(32),
  `transaction_service_group` varchar(32),
  `transaction_name` varchar(128),
  `timeout` int,
  `begin_time` bigint,
  `application_data` varchar(2000),
  `gmt_create` datetime,
  `gmt_modified` datetime,
  primary key (`xid`),
  key `idx_gmt_modified_status` (`gmt_modified`, `status`),
  key `idx_transaction_id` (`transaction_id`)
);
 
-- the table to store BranchSession data
drop table if exists `branch_table`;
create table `branch_table` (
  `branch_id` bigint not null,
  `xid` varchar(128) not null,
  `transaction_id` bigint ,
  `resource_group_id` varchar(32),
  `resource_id` varchar(256) ,
  `lock_key` varchar(128) ,
  `branch_type` varchar(8) ,
  `status` tinyint,
  `client_id` varchar(64),
  `application_data` varchar(2000),
  `gmt_create` datetime,
  `gmt_modified` datetime,
  primary key (`branch_id`),
  key `idx_xid` (`xid`)
);
 
-- the table to store lock data
drop table if exists `lock_table`;
create table `lock_table` (
  `row_key` varchar(128) not null,
  `xid` varchar(96),
  `transaction_id` long ,
  `branch_id` long,
  `resource_id` varchar(256) ,
  `table_name` varchar(32) ,
  `pk` varchar(36) ,
  `gmt_create` datetime ,
  `gmt_modified` datetime,
  primary key(`row_key`)
);
 
-- the table to store seata xid data
-- 0.7.0+ add context
-- you must to init this sql for you business databese. the seata server not need it.
-- 此脚本必须初始化在你当前的业务数据库中，用于AT 模式XID记录。与server端无关（注：业务数据库）
-- 注意此处0.3.0+ 增加唯一索引 ux_undo_log
drop table `undo_log`;
CREATE TABLE `undo_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `branch_id` bigint(20) NOT NULL,
  `xid` varchar(100) NOT NULL,
  `context` varchar(128) NOT NULL,
  `rollback_info` longblob NOT NULL,
  `log_status` int(11) NOT NULL,
  `log_created` datetime NOT NULL,
  `log_modified` datetime NOT NULL,
  `ext` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_undo_log` (`xid`,`branch_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8;
```


##### 5、启动

在启动nacos-server后，点击 `seata/bin/seata-server.bat`启动seata。


##### 6、微服务改造

- 在微服务中引入seata的依赖：

```xml
<dependency>
    <groupId>io.seata</groupId>
    <artifactId>seata-spring-boot-starter</artifactId>
    <version>1.3.0</version>
</dependency>
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-seata</artifactId>
    <exclusions>
        <exclusion>
            <groupId>io.seata</groupId>
            <artifactId>seata-spring-boot-starter</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

如果微服务中使用的是druid连接池，可以把已有的druid依赖删除，在seata-spring-boot-starter-1.3.0中已经引入了druid-1.1.12。

- 修改每一个微服务yml，主要是配置nacos和seata，tx-service-group就是nacos-config.txt 中 service.vgroupMapping的key，我们这里使用微服务的名称加上group后缀

```yml
server:
  port: 8763

spring:
  application:
    name: order-service
  cloud:
    nacos:
      server-addr: 127.0.0.1:8848
  datasource:
    url: jdbc:mysql://localhost:3306/tenant?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC
    username: hydra
    password: 123456
    driver-class-name: com.mysql.cj.jdbc.Driver
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      initial-size: 8
      min-idle: 1
      max-active: 10
      max-wait: 60000

seata:
  enabled: true
  application-id: ${spring.application.name}
  tx-service-group: ${spring.application.name}-group
  enable-auto-data-source-proxy: true
  config:
    type: nacos
    nacos:
      server-addr: 127.0.0.1:8848
      namespace: 202274f4-218e-42bf-9251-e996df6340f8
      group: SEATA_GROUP
      username: nacos
      password: nacos
  registry:
    type: nacos
    nacos:
      application: seata-server
      server-addr: 127.0.0.1:8848
      namespace: 202274f4-218e-42bf-9251-e996df6340f8
      group: SEATA_GROUP
      username: nacos
      password: nacos
#  service:
#    vgroupMapping:
#      order-service-group: default

mybatis-plus:
  mapper-locations: classpath:mapper/*Mapper.xml
  type-aliases-package: com.cn.nacos.consumer.entity
```

- 配置seata的数据库代理，在使用mybatis-plus时的配置方式如下：

```java
@Configuration
public class DataSourceProxyConfig {
    @Bean
    public SqlSessionFactory sqlSessionFactoryBean(DataSource dataSource) throws Exception {
        // 订单服务中引入了mybatis-plus，所以要使用特殊的SqlSessionFactoryBean
        MybatisSqlSessionFactoryBean sqlSessionFactoryBean = new MybatisSqlSessionFactoryBean();
        // 代理数据源
        sqlSessionFactoryBean.setDataSource(new DataSourceProxy(dataSource));
        // 生成SqlSessionFactory
        return sqlSessionFactoryBean.getObject();
    }
}
```

- 调用测试，OrderService调用StockService为例，在被调用的service方法上加上`@Transactional`注解

StockService提供接口：

```java
@Service
public class StockService {
    @Autowired
    private StockMapper stockMapper;

    @Transactional
    public String reduce(){
        System.out.println("减库存");

        Stock stock = stockMapper.selectOne(new LambdaQueryWrapper<Stock>().eq(Stock::getId, 1));
        System.out.println(stock.toString());

        stock.setQuantity(stock.getQuantity()-1);
        int result = stockMapper.updateById(stock);
        System.out.println("update result: "+result);

        if (result==1){
            throw new RuntimeException("异常测试，准备rollBack");
        }
        return "stock reduce success";
    }
}
```

OrderService调用StockService的服务，使用了FeignClient调用StockService，并在发起事务的方法上加上`@GlobalTransactional`注解：

```java
@Service
public class OrderService {
    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private StockClient stockClient;

    @GlobalTransactional
    public String buy(){
        Order order=new Order();
        order.setId(1L).setMoney(20D);
        int result = orderMapper.insert(order);

        if (result==1){
            System.out.println("插入订单成功");
        }
        return stockClient.reduce();
    }
}
```

调用OrderService的接口，会在StockService中抛出异常，reduce方法中的本地事务先执行回滚。再查看日志，在order表上执行了回滚操作：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1aff0b2a77fe4a459ae2099434bc9ab8~tplv-k3u1fbpfcp-zoom-1.image)

在上面的日志中，打印出了全局事务的xid、分支的branchId、以及seata使用的模式，在使用AT模式的二阶段提交完成后，显示回滚状态为回滚完成。查看业务数据库的und_log表，已经插入了回滚记录：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/10cca25f2e1441538dc792f2257ec33b~tplv-k3u1fbpfcp-zoom-1.image)

这样，就以Seata中默认的AT模式实现了分布式事务。在该模式下，可以应对大多数的业务场景，并且基本可以做到无业务入侵，对于程序员来说，只需要添加注解，不需要做其他的业务功能改造，就可以以无感知的方式就可以实现分布式事务的解决。

