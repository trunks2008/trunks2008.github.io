---
title: 基于Mybatis-plus实现多租户架构
icon: page
order: 4
author: Hydra
date: 2020-12-06
tag:
  - Mybatis-plus
  - 多租户
star: true
---



<!-- more -->

多租户(`Multi-Tenant`)是SaaS中的一个重要概念，它是一种软件架构技术，在多个租户的环境下，共享同一套系统实例，并且租户之间的数据具有隔离性，也就是说一个租户不能去访问其他租户的数据。基于不同的隔离级别，通常具有下面三种实现方案：


1、每个租户使用独立`DataBase`，隔离级别高，性能好，但成本大

2、租户之间共享`DataBase`，使用独立的`Schema`

3、租户之间共享`Schema`，在表上添加租户字段，共享数据程度最高，隔离级别最低。


`Mybatis-plus`在第3层隔离级别上，提供了基于分页插件的多租户的解决方案，我们对此来进行介绍。在正式开始前，首先做好准备工作创建两张表，在基础字段后都添加租户字段`tenant_id`：
```sql
CREATE TABLE `user` (
  `id` bigint(20) NOT NULL,
  `name` varchar(20) DEFAULT NULL,
  `phone` varchar(11) DEFAULT NULL,
  `address` varchar(64) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
)
CREATE TABLE `dept` (
  `id` bigint(20) NOT NULL,
  `dept_name` varchar(64) DEFAULT NULL,
  `comment` varchar(128) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
)
```

在项目中导入需要的依赖：
```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-boot-starter</artifactId>
    <version>3.3.2</version>
</dependency>
<dependency>
    <groupId>com.github.jsqlparser</groupId>
    <artifactId>jsqlparser</artifactId>
    <version>3.1</version>
</dependency>
```

Mybatis-plus 配置类：
```java
@EnableTransactionManagement(proxyTargetClass = true)
@Configuration
public class MybatisPlusConfig {
    @Bean
    public PaginationInterceptor paginationInterceptor() {
        PaginationInterceptor paginationInterceptor = new PaginationInterceptor();

        List<ISqlParser> sqlParserList=new ArrayList<>();
        TenantSqlParser tenantSqlParser=new TenantSqlParser();
        tenantSqlParser.setTenantHandler(new TenantHandler() {
            @Override
            public Expression getTenantId(boolean select) {               
                String tenantId = "3";
                return new StringValue(tenantId);
            }

            @Override
            public String getTenantIdColumn() {
                return "tenant_id";
            }

            @Override
            public boolean doTableFilter(String tableName) {
                return false;
            }
        });

        sqlParserList.add(tenantSqlParser);
        paginationInterceptor.setSqlParserList(sqlParserList);
        return paginationInterceptor;
    }
}
```
这里主要实现的功能：

- 创建SQL解析器集合

- 创建租户SQL解析器

- 设置租户处理器，具体处理租户逻辑



这里暂时把租户的id固定写成3，来进行测试。测试执行全表语句：
```java
public List<User> getUserList() {
    return userMapper.selectList(new LambdaQueryWrapper<User>().isNotNull(User::getId));
}
```
使用插件解析执行的SQL语句，可以看到自动在查询条件后加上了租户过滤条件：


![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a9dd211b0ea24f20805ebb9ab889094c~tplv-k3u1fbpfcp-zoom-1.image)



那么在实际的项目中，怎么将租户信息传给租户处理器呢，根据情况我们可以从缓存或者请求头中获取，以从Request请求头获取为例：
```java
@Override
public Expression getTenantId(boolean select) {
    ServletRequestAttributes attributes=(ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
    HttpServletRequest request = attributes.getRequest();
    String tenantId = request.getHeader("tenantId");
    return new StringValue(tenantId);
}
```
前端在发起http请求时，在Header中加入tenantId字段，后端在处理器中获取后，设置为当前这次请求的租户过滤条件。



如果是基于请求头携带租户信息的情况，那么在使用中可能会遇到一个坑，如果当使用多线程的时候，新开启的异步线程并不会自动携带当前线程的Request请求。
```java
@Override
public List<User> getUserListByFuture() {
    Callable getUser=()-> userMapper.selectList(new LambdaQueryWrapper<User>().isNotNull(User::getId));
    FutureTask<List<User>> future=new FutureTask<>(getUser);
    new Thread(future).start();
    try {
        return future.get();
    } catch (Exception e) {
        e.printStackTrace();
    }
    return null;
}
```
执行上面的方法，可以看出是获取不到当前的Request请求的，因此无法获得租户id，会导致后续报错空指针异常：



![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a807eb54339d435386ee8fea18b7aeec~tplv-k3u1fbpfcp-zoom-1.image)



修改的话也非常简单，开启RequestAttributes的子线程共享，修改上面的代码：
```java
@Override
public List<User> getUserListByFuture() {
    ServletRequestAttributes sra = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
    Callable getUser=()-> {
        RequestContextHolder.setRequestAttributes(sra, true);
        return userMapper.selectList(new LambdaQueryWrapper<User>().isNotNull(User::getId));
    };
    FutureTask<List<User>> future=new FutureTask<>(getUser);
    new Thread(future).start();
    try {
        return future.get();
    } catch (Exception e) {
        e.printStackTrace();
    }
    return null;
}
```
这样修改后，在异步线程中也能正常的获取租户信息了。



那么，有的小伙伴可能要问了，在业务中并不是所有的查询都需要过滤租户条件啊，针对这种情况，有两种方式来进行处理。



1、如果整张表的所有SQL操作都不需要针对租户进行操作，那么就对表进行过滤，修改doTableFilter方法，添加表的名称：
```java
@Override
public boolean doTableFilter(String tableName) {
    List<String> IGNORE_TENANT_TABLES= Arrays.asList("dept");
    return IGNORE_TENANT_TABLES.stream().anyMatch(e->e.equalsIgnoreCase(tableName));
}
```
这样，在dept表的所有查询都不进行过滤：



![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7b549012829e4f8984367b899fc231a4~tplv-k3u1fbpfcp-zoom-1.image)



2、如果有一些特定的SQL语句不想被执行租户过滤，可以通过@SqlParser注解的形式开启，注意注解只能加在Mapper接口的方法上：
```java
@SqlParser(filter = true)
@Select("select * from user where name =#{name}")
User selectUserByName(@Param(value="name") String name);
```

或在分页拦截器中指定需要过滤的方法：
```java
@Bean
public PaginationInterceptor paginationInterceptor() {
    PaginationInterceptor paginationInterceptor = new PaginationInterceptor();
    paginationInterceptor.setSqlParserFilter(metaObject->{
        MappedStatement ms = SqlParserHelper.getMappedStatement(metaObject);
        // 对应Mapper、dao中的方法
        if("com.cn.tenant.dao.UserMapper.selectUserByPhone".equals(ms.getId())){
            return true;
        }
        return false;
    });
    ...
}
```
上面这两种方式实现的功能相同，但是如果需要过滤的SQL语句很多，那么第二种方式配置起来会比较麻烦，因此建议通过注解的方式进行过滤。



除此之外，还有一个比较容易踩的坑就是在复制Bean时，不要复制租户id字段，否则会导致SQL语句报错：
```java
public void createSnapshot(Long userId){
    User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getId, userId));
    UserSnapshot userSnapshot=new UserSnapshot();
    BeanUtil.copyProperties(user,userSnapshot);
    userSnapshotMapper.insert(userSnapshot);
}
```

查看报错可以看出，本身Bean的租户字段不为空的情况下，SQL又自动添加一次租户查询条件，因此导致了报错：



![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d4829b9b6cc44d7fac0239dce8a3e090~tplv-k3u1fbpfcp-zoom-1.image)



我们可以修改复制Bean语句，手动忽略租户id字段，这里使用的是hutool的BeanUtil工具类，可以添加忽略字段。
```java
BeanUtil.copyProperties(user,userSnapshot,"tenantId");
```
在忽略了租户id的拷贝后，查询可以正常执行。



最后，再来看一下对联表查询的支持，首先看一下包含子查询的SQL：
```java
@Select("select * from user where id in (select id from user_snapshot)")
List<User> selectSnapshot();
```
查看执行结果，可以看见，在子查询的内部也自动添加的租户查询条件：



![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0ed4a084d4f246f5b594978ec4c96993~tplv-k3u1fbpfcp-zoom-1.image)



再来看一下使用Join进行联表查询：
```java
@Select("select u.* from user u left join user_snapshot us on u.id=us.id")
List<User> selectSnapshot();
```
同样，会在左右两张表上都添加租户的过滤条件：



![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e11d373798674d038f4e0190e086f0cc~tplv-k3u1fbpfcp-zoom-1.image)



再看一下不使用Join的普通联表查询：
```java
@Select("select u.* from user u ,user_snapshot us,dept d where u.id=us.id and d.id is not null")
List<User> selectSnapshot();
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/452a9b0837ef4aa58a8492c9cdc5afa1~tplv-k3u1fbpfcp-zoom-1.image)



查看执行结果，可以看见在这种情况下，只在FROM关键字后面的第一张表上添加了租户的过滤条件，因此如果使用这种查询方式，需要额外注意，用户需要手动在SQL语句中添加租户过滤。