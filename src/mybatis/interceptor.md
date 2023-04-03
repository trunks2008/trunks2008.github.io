---
title: Mybatis自定义拦截器与插件开发
icon: page
order: 2
author: Hydra
date: 2021-03-21
tag:
  - MyBatis
  - Plugin
star: true
---



<!-- more -->

在Spring中我们经常会使用到拦截器，在登录验证、日志记录、性能监控等场景中，通过使用拦截器允许我们在不改动业务代码的情况下，执行拦截器的方法来增强现有的逻辑。在mybatis中，同样也有这样的业务场景，有时候需要我们在不侵入原有业务代码的情况下拦截sql，执行特定的某些逻辑。那么这个过程应该怎么实现呢，同样，在mybatis中也为开发者预留了拦截器接口，通过实现自定义拦截器这一功能，可以实现我们自己的插件，允许用户在不改动mybatis的原有逻辑的条件下，实现自己的逻辑扩展。

那么，在实现拦截器之前，首先看一下拦截器的拦截目标对象是什么，以及拦截器的工作流程是怎样的？

#### 拦截器核心对象

mybatis拦截器可以对下面4种对象进行拦截：

1、`Executor`：mybatis的内部执行器，作为调度核心负责调用`StatementHandler`操作数据库，并把结果集通过`ResultSetHandler`进行自动映射

2、`StatementHandler`： 封装了`JDBC Statement`操作，是sql语法的构建器，负责和数据库进行交互执行sql语句

3、`ParameterHandler`：作为处理sql参数设置的对象，主要实现读取参数和对`PreparedStatement`的参数进行赋值

4、`ResultSetHandler`：处理`Statement`执行完成后返回结果集的接口对象，mybatis通过它把`ResultSet`集合映射成实体对象

#### 工作流程

在mybatis中提供了一个`Interceptor`接口，通过实现该接口就能够自定义拦截器，接口中定义了3个方法：

```java
public interface Interceptor {
  Object intercept(Invocation invocation) throws Throwable;
  default Object plugin(Object target) {
    return Plugin.wrap(target, this);
  }
  default void setProperties(Properties properties) {
    // NOP
  }
}
```

- `intercept`：在拦截目标对象的方法时，实际执行的增强逻辑，我们一般在该方法中实现自定义逻辑

- `plugin`：用于返回原生目标对象或它的代理对象，当返回的是代理对象的时候，会调用`intercept`方法

- `setProperties`：可以用于读取配置文件中通过`property`标签配置的一些属性，设置一些属性变量

看一下`plugin`方法中的`wrap`方法源码：

```java
public static Object wrap(Object target, Interceptor interceptor) {
  Map<Class<?>, Set<Method>> signatureMap = getSignatureMap(interceptor);
  Class<?> type = target.getClass();
  Class<?>[] interfaces = getAllInterfaces(type, signatureMap);
  if (interfaces.length > 0) {
    return Proxy.newProxyInstance(
        type.getClassLoader(),
        interfaces,
        new Plugin(target, interceptor, signatureMap));
  }
  return target;
}
```

可以看到，在`wrap`方法中，通过使用jdk动态代理的方式，生成了目标对象的代理对象，在执行实际方法前，先执行代理对象中的逻辑，来实现的逻辑增强。以拦截`Executor`的`query`方法为例，在实际执行前会执行拦截器中的`intercept`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80b0ecfb696646b986b2cbc4c314c491~tplv-k3u1fbpfcp-zoom-1.image)

在mybatis中，不同类型的拦截器按照下面的顺序执行：

> `Executor -> StatementHandler -> ParameterHandler -> ResultSetHandler`

以执行`query` 方法为例对流程进行梳理，整体流程如下：

1、`Executor`执行`query()`方法，创建一个`StatementHandler`对象

2、`StatementHandler` 调用`ParameterHandler`对象的`setParameters()`方法

3、`StatementHandler` 调用 `Statement`对象的`execute()`方法

4、`StatementHandler` 调用`ResultSetHandler`对象的`handleResultSets()`方法，返回最终结果

#### 拦截器能实现什么

在对mybatis拦截器有了初步的认识后，来看一下拦截器被普遍应用在哪些方面：

- sql 语句执行监控

  可以拦截执行的sql方法，可以打印执行的sql语句、参数等信息，并且还能够记录执行的总耗时，可供后期的sql分析时使用

- sql 分页查询

  mybatis中使用的`RowBounds`使用的内存分页，在分页前会查询所有符合条件的数据，在数据量大的情况下性能较差。通过拦截器，可以做到在查询前修改sql语句，提前加上需要的分页参数

- 公共字段的赋值

  在数据库中通常会有`createTime`，`updateTime`等公共字段，这类字段可以通过拦截统一对参数进行的赋值，从而省去手工通过`set`方法赋值的繁琐过程

- 数据权限过滤

  在很多系统中，不同的用户可能拥有不同的数据访问权限，例如在多租户的系统中，要做到租户间的数据隔离，每个租户只能访问到自己的数据，通过拦截器改写sql语句及参数，能够实现对数据的自动过滤

除此之外，拦截器通过对上述的4个阶段的介入，结合我们的实际业务场景，还能够实现很多其他功能。

#### 插件定义与注册

在我们自定义的拦截器类实现了`Interceptor`接口后，还需要在类上添加`@Intercepts` 注解，标识该类是一个拦截器类。注解中的内容是一个`@Signature`对象的数组，指明自定义拦截器要拦截哪一个类型的哪一个具体方法。其中`type`指明拦截对象的类型，`method`是拦截的方法，`args`是`method`执行的参数。通过这里可以了解到 mybatis 拦截器的作用目标是在`方法级别`上进行拦截，例如要拦截`Executor`的`query`方法，就在类上添加：

```java
@Intercepts({
        @Signature(type = Executor.class,method = "query", args = { MappedStatement.class, Object.class,
                RowBounds.class, ResultHandler.class })
})
```

如果要拦截多个方法，可以继续以数组的形式往后追加。这里通过添加参数可以确定唯一的拦截方法，例如在`Executor`中存在两个`query`方法，通过上面的参数可以确定要拦截的是下面的第2个方法：

```java
<E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler, CacheKey cacheKey, BoundSql boundSql);
<E> List<E> query(MappedStatement ms, Object parameter, RowBounds rowBounds, ResultHandler resultHandler);
```

当编写完成我们自己的插件后，需要向mybatis中注册插件，有两种方式可以使用，第一种直接在`SqlSessionFactory`中配置:

```java
@Bean
public SqlSessionFactory sqlSessionFactory(DataSource dataSource) throws Exception {
    SqlSessionFactoryBean sqlSessionFactoryBean = new SqlSessionFactoryBean();
    sqlSessionFactoryBean.setDataSource(dataSource);
    sqlSessionFactoryBean.setPlugins(new Interceptor[]{new ExecutorPlugin()});
    return sqlSessionFactoryBean.getObject();
}
```

第2种是在`mybatis-config.xml`中对自定义插件进行注册：

```xml
<configuration>
    <plugins>
        <plugin interceptor="com.cn.plugin.interceptor.MyPlugin">
        	<property name="text" value="hello"/>
        </plugin>
        <plugin interceptor="com.cn.plugin.interceptor.MyPlugin2"></plugin>
        <plugin interceptor="com.cn.plugin.interceptor.MyPlugin3"></plugin>
    </plugins>
</configuration>
```

在前面我们了解了不同类型拦截器执行的固定顺序，那么对于同样类型的多个自定义拦截器，它们的执行顺序是怎样的呢？分别在`plugin`方法和`intercept`中添加输出语句，运行结果如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4d020df5aec04c7e9aea2ee95cdfeafc~tplv-k3u1fbpfcp-zoom-1.image)

从结果可以看到，拦截顺序是按照注册顺序执行的，但代理逻辑的执行顺序正好相反，最后注册的会被最先执行。这是因为在mybatis中有一个类`InterceptorChain`，在它的`pluginAll()`方法中，会对原生对象`target`进行代理，如果有多个拦截器的话，会对代理类再次进行代理，最终实现一层层的增强`target`对象，因此靠后被注册的拦截器的增强逻辑会被优先执行。从下面的图中可以直观的看出代理的嵌套关系：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c60020ab5f6d48a9bfe5ae721c6f2fdd~tplv-k3u1fbpfcp-zoom-1.image)

在`xml`中注册完成后，在`application.yml`中启用配置文件，这样插件就可以正常运行了：

```yml
mybatis:
  config-location: classpath:mybatis-config.xml
```

在了解了插件的基础概念与运行流程之后，通过代码看一下应用不同的拦截器能够实现什么功能。

#### 拦截器使用示例

##### Executor

通过拦截`Executor`的`query`和`update`方法实现对sql的监控，在拦截方法中，打印sql语句、执行参数、实际执行时间：

```java
@Intercepts({
        @Signature(type = Executor.class,method = "update", args = {MappedStatement.class, Object.class}),
        @Signature(type = Executor.class,method = "query", args = { MappedStatement.class, Object.class,
                RowBounds.class, ResultHandler.class })})
public class ExecutorPlugin implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        System.out.println("Executor Plugin 拦截 :"+invocation.getMethod());
        Object[] queryArgs = invocation.getArgs();
        MappedStatement mappedStatement = (MappedStatement) queryArgs[0];
        //获取 ParamMap
        MapperMethod.ParamMap paramMap = (MapperMethod.ParamMap) queryArgs[1];
        // 获取SQL
        BoundSql boundSql = mappedStatement.getBoundSql(paramMap);
        String sql = boundSql.getSql();
        log.info("==> ORIGIN SQL: "+sql);
        long startTime = System.currentTimeMillis();
        Configuration configuration = mappedStatement.getConfiguration();
        String sqlId = mappedStatement.getId();

        Object proceed = invocation.proceed();
        long endTime=System.currentTimeMillis();
        long time = endTime - startTime;
        printSqlLog(configuration,boundSql,sqlId,time);
        return proceed;
    }

    public static void printSqlLog(Configuration configuration, BoundSql boundSql, String sqlId, long time){
        Object parameterObject = boundSql.getParameterObject();
        List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();
        String sql= boundSql.getSql().replaceAll("[\\s]+", " ");
        StringBuffer sb=new StringBuffer("==> PARAM:");
        if (parameterMappings.size()>0 && parameterObject!=null){
            TypeHandlerRegistry typeHandlerRegistry = configuration.getTypeHandlerRegistry();
            if (typeHandlerRegistry.hasTypeHandler(parameterObject.getClass())) {
                sql = sql.replaceFirst("\\?", parameterObject.toString());
            } else {
                MetaObject metaObject = configuration.newMetaObject(parameterObject);
                for (ParameterMapping parameterMapping : parameterMappings) {
                    String propertyName = parameterMapping.getProperty();
                    if (metaObject.hasGetter(propertyName)) {
                        Object obj = metaObject.getValue(propertyName);
                        String parameterValue = obj.toString();
                        sql = sql.replaceFirst("\\?", parameterValue);
                        sb.append(parameterValue).append("(").append(obj.getClass().getSimpleName()).append("),");
                    } else if (boundSql.hasAdditionalParameter(propertyName)) {
                        Object obj = boundSql.getAdditionalParameter(propertyName);
                        String parameterValue = obj.toString();
                        sql = sql.replaceFirst("\\?", parameterValue);
                        sb.append(parameterValue).append("(").append(obj.getClass().getSimpleName()).append("),");
                    }
                }
            }
            sb.deleteCharAt(sb.length()-1);
        }
        log.info("==> SQL:"+sql);
        log.info(sb.toString());
        log.info("==> SQL TIME:"+time+" ms");
    }
}
```

执行代码，日志输出如下：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7f033c67c66d42caa8995db8e0021c6e~tplv-k3u1fbpfcp-zoom-1.image)

在上面的代码中，通过`Executor`拦截器获取到了`BoundSql`对象，进一步获取到sql的执行参数，从而实现了对sql执行的监控与统计。

##### StatementHandler

下面的例子中，通过改变`StatementHandler`对象的属性，动态修改sql语句的分页：

```java
@Intercepts({
        @Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class})})
public class StatementPlugin implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {        
        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        MetaObject metaObject = SystemMetaObject.forObject(statementHandler);            
        metaObject.setValue("delegate.rowBounds.offset", 0);
        metaObject.setValue("delegate.rowBounds.limit", 2);
        return invocation.proceed();
    }
}
```

`MetaObject`是mybatis提供的一个用于方便、优雅访问对象属性的对象，通过将实例对象作为参数传递给它，就可以通过属性名称获取对应的属性值。虽然说我们也可以通过反射拿到属性的值，但是反射过程中需要对各种异常做出处理，会使代码中堆满难看的`try/catch`，通过`MetaObject`可以在很大程度上简化我们的代码，并且它支持对`Bean`、`Collection`、`Map`三种类型对象的操作。

对比执行前后：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ed11dd3a068a4df68cd7c09189aa81fc~tplv-k3u1fbpfcp-zoom-1.image)

可以看到这里通过改变了分页对象`RowBounds`的属性，动态的修改了分页参数。

##### ResultSetHandler

`ResultSetHandler` 会负责映射sql语句查询得到的结果集，如果在生产环境中存在一些保密数据，不想在外部系统中展示，那么可能就需要在查询到结果后做一下数据的脱敏处理，这时候就可以使用`ResultSetHandler`对结果集进行改写。

```java
@Intercepts({
        @Signature(type= ResultSetHandler.class,method = "handleResultSets",args = {Statement.class})})
public class ResultSetPlugin implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        System.out.println("Result Plugin 拦截 :"+invocation.getMethod());
        Object result = invocation.proceed();
        if (result instanceof Collection) {
            Collection<Object> objList= (Collection) result;
            List<Object> resultList=new ArrayList<>();
            for (Object obj : objList) {
                resultList.add(desensitize(obj));
            }
            return resultList;
        }else {
            return desensitize(result);
        }
    }
	//脱敏方法，将加密字段变为星号
    private Object desensitize(Object object) throws InvocationTargetException, IllegalAccessException {
        Field[] fields = object.getClass().getDeclaredFields();
        for (Field field : fields) {
            Confidential confidential = field.getAnnotation(Confidential.class);
            if (confidential==null){
                continue;
            }
            PropertyDescriptor ps = BeanUtils.getPropertyDescriptor(object.getClass(), field.getName());
            if (ps.getReadMethod() == null || ps.getWriteMethod() == null) {
                continue;
            }
            Object value = ps.getReadMethod().invoke(object);
            if (value != null) {
                ps.getWriteMethod().invoke(object, "***");
            }
        }
        return object;
    }
}
```

运行上面的代码，查看执行结果：

```json
{"id":1358041517788299266,"orderNumber":"***","money":122.0,"status":3,"tenantId":2}
```

在上面的例子中，在执行完sql语句得到结果对象后，通过反射扫描结果对象中的属性，如果实体的属性上带有自定义的`@Confidential`注解，那么在脱敏方法中将它转化为星号再返回结果，从而实现了数据的脱敏处理。

##### ParameterHandler

mybatis可以拦截`ParameterHandler`注入参数，下面的例子中我们将结合前面介绍的其他种类的对象，通过组合拦截器的方式，实现一个简单的多租户拦截器插件，实现多租户下的查询逻辑。

```java
@Intercepts({
        @Signature(type = Executor.class,method = "query", args = { MappedStatement.class, Object.class,RowBounds.class, ResultHandler.class }),
        @Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class}),
        @Signature(type = ParameterHandler.class, method = "setParameters", args = PreparedStatement.class),
})
public class TenantPlugin implements Interceptor {
    private static final String TENANT_ID = "tenantId";

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        Object target = invocation.getTarget();
        String methodName = invocation.getMethod().getName();
        if (target instanceof Executor &&  methodName.equals("query") && invocation.getArgs().length==4) {
            return doQuery(invocation);
        }
        if (target instanceof StatementHandler){
            return changeBoundSql(invocation);
        }
        if (target instanceof ParameterHandler){
            return doSetParameter(invocation);
        }
        return null;
    }

    private Object doQuery(Invocation invocation) throws Exception{
        Executor executor = (Executor) invocation.getTarget();
        MappedStatement ms= (MappedStatement) invocation.getArgs()[0];
        Object paramObj = invocation.getArgs()[1];
        RowBounds rowBounds = (RowBounds) invocation.getArgs()[2];

        if (paramObj instanceof Map){
            MapperMethod.ParamMap paramMap= (MapperMethod.ParamMap) paramObj;
            if (!paramMap.containsKey(TENANT_ID)){
                Long tenantId=1L;
                paramMap.put("param"+(paramMap.size()/2+1),tenantId);
                paramMap.put(TENANT_ID,tenantId);
                paramObj=paramMap;
            }
        }
        //直接执行query，不用proceed()方法
        return executor.query(ms, paramObj,rowBounds,null);
    }

    private Object changeBoundSql(Invocation invocation) throws Exception {
        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        MetaObject metaObject = SystemMetaObject.forObject(statementHandler);
        PreparedStatementHandler preparedStatementHandler = (PreparedStatementHandler) metaObject.getValue("delegate");
        String originalSql = (String) metaObject.getValue("delegate.boundSql.sql");
        metaObject.setValue("delegate.boundSql.sql",originalSql+ " and tenant_id=?");
        return invocation.proceed();
    }

    private Object doSetParameter(Invocation invocation) throws Exception {
        ParameterHandler parameterHandler = (ParameterHandler) invocation.getTarget();
        PreparedStatement ps = (PreparedStatement) invocation.getArgs()[0];
        MetaObject metaObject = SystemMetaObject.forObject(parameterHandler);
        BoundSql boundSql= (BoundSql) metaObject.getValue("boundSql");

        List<ParameterMapping> parameterMappings = boundSql.getParameterMappings();
        boolean hasTenantId=false;
        for (ParameterMapping parameterMapping : parameterMappings) {
            if (parameterMapping.getProperty().equals(TENANT_ID)) {
                hasTenantId=true;
            }
        }
        //添加参数
        if (!hasTenantId){
            Configuration conf= (Configuration) metaObject.getValue("configuration");
            ParameterMapping parameterMapping= new ParameterMapping.Builder(conf,TENANT_ID,Long.class).build();
            parameterMappings.add(parameterMapping);
        }
        parameterHandler.setParameters(ps);
        return null;
    }
}
```

在上面的过程中，拦截了sql执行的三个阶段，来实现多租户的逻辑，逻辑分工如下：

- 拦截`Executor`的`query`方法，在查询的参数`Map`中添加租户的属性值，这里只是简单的对`Map`的情况作了判断，没有对`Bean`的情况进行设置
- 拦截`StatementHandler`的`prepare`方法，改写sql语句对象`BoundSql`，在sql语句中拼接租户字段的查询条件
- 拦截`ParameterHandler`的`setParameters`方法，动态设置参数，将租户id添加到要设置到参数列表中

最终通过拦截不同执行阶段的组合，实现了基于租户的条件拦截。

#### 总结

总的来说，mybatis拦截器通过对`Executor`、`StatementHandler`、`ParameterHandler`、`ResultSetHandler` 这4种接口中的方法进行拦截，并生成代理对象，在执行方法前先执行代理对象的逻辑，来实现我们自定义的逻辑增强。从上面的例子中，可以看到通过灵活使用mybatis拦截器开发插件能够帮助我们解决很多问题，但是同样它也是一把双刃剑，在实际工作中也不要滥用插件、定义过多的拦截器，因为通过学习我们知道mybatis插件在执行中使用到了代理模式和责任链模式，在执行sql语句前会经过层层代理，如果代理次数过多将会消耗额外的性能，并增加响应时间。
