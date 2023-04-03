---
title: OAuth2.0授权码模式原理与实战
icon: page
order: 2
author: Hydra
date: 2021-03-10
tag:
  - OAuth
  - Spring Cloud
star: true
---



<!-- more -->

OAuth2.0是目前比较流行的一种开源授权协议，可以用来授权第三方应用，允许在不将用户名和密码提供给第三方应用的情况下获取一定的用户资源，目前很多网站或APP基于微信或QQ的第三方登录方式都是基于OAuth2实现的。本文将基于OAuth2中的授权码模式，采用数据库配置方式，搭建认证服务器与资源服务器，完成授权与资源的访问。

### 流程分析

在OAuth2中，定义了4种不同的授权模式，其中授权码模式（`authorization code`）功能流程相对更加完善，也被更多的系统采用。首先使用图解的方式简单了解一下它的授权流程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b087d58831eb45a18824442c7331091e~tplv-k3u1fbpfcp-zoom-1.image)

- 对上面的流程进行一下说明：
  1、用户访问客户端

  2、客户端将用户导向认证服务器

  3、用户登录，并对第三方客户端进行授权

  4、认证服务器将用户导向客户端事先指定的重定向地址，并附上一个授权码

  5、客户端使用授权码，向认证服务器换取令牌

  6、认证服务器对客户端进行认证以后，发放令牌

  7、客户端使用令牌，向资源服务器申请获取资源

  8、资源服务器确认令牌，向客户端开放资源

在对授权码模式的流程有了一定基础的情况下，我们开始动手搭建项目。

### 项目搭建

#### 准备工作

1、在Project中创建两个module，采用认证服务器和资源服务器分离的架构：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/943d14c7444b47abad17218bff6291db~tplv-k3u1fbpfcp-zoom-1.image)

2、`spring-security-oauth2`是对`Oauth2`协议规范的一种实现，这里可以直接使用`spring-cloud-starter-oauth2`，就不需要分别引入`spring-security`和`oauth2`了。在父pom中引入：

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-oauth2</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

3、数据库建表，`OAuth2`需要的表结构如下：

```sql
DROP TABLE IF EXISTS `oauth_access_token`;
CREATE TABLE `oauth_access_token`  (
  `token_id` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `token` blob NULL,
  `authentication_id` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `user_name` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `client_id` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `authentication` blob NULL,
  `refresh_token` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

DROP TABLE IF EXISTS `oauth_client_details`;
CREATE TABLE `oauth_client_details`  (
  `client_id` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `resource_ids` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `client_secret` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `scope` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `authorized_grant_types` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `web_server_redirect_uri` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `authorities` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `access_token_validity` int(11) NULL DEFAULT NULL,
  `refresh_token_validity` int(11) NULL DEFAULT NULL,
  `additional_information` text CHARACTER SET utf8 COLLATE utf8_general_ci NULL,
  `autoapprove` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT 'false',
  PRIMARY KEY (`client_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

DROP TABLE IF EXISTS `oauth_code`;
CREATE TABLE `oauth_code`  (
  `code` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `authentication` blob NULL
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

DROP TABLE IF EXISTS `oauth_refresh_token`;
CREATE TABLE `oauth_refresh_token`  (
  `token_id` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NULL DEFAULT NULL,
  `token` blob NULL,
  `authentication` blob NULL
) ENGINE = InnoDB CHARACTER SET = utf8 COLLATE = utf8_general_ci ROW_FORMAT = Dynamic;

```

- `oauth_access_token`：存储生成的access_token，由类`JdbcTokenStore`操作
- `oauth_client_details`：存储客户端的配置信息，由类`JdbcClientDetailsService`操作
- `oauth_code`：存储服务端系统生成的code的值，由类`JdbcAuthorizationCodeServices`操作
- `oauth_refresh_token`：存储刷新令牌的refresh_token，如果客户端的grant_type不支持refresh_token，那么不会用到这张表，同样由类`JdbcTokenStore`操作

其余`spring security`相关的用户表、角色表以及权限表的表结构在这里省略，可以在文末的Git地址中下载。

#### 认证服务器

认证服务器是服务提供者专门用来处理认证授权的服务器，主要负责获取用户授权并颁发`token`，以及完成后续的`token`认证工作。认证部分功能主要由`spring security` 负责，授权则由`oauth2`负责。

1、开启`Spring Security`配置

```java
@Configuration
@EnableWebSecurity
public class WebSecurityConfig extends WebSecurityConfigurerAdapter {
    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Override
    @Bean
    public AuthenticationManager authenticationManagerBean() throws Exception {
        return super.authenticationManagerBean();
    }
}
```

通过`@Configuration` 和`@EnableWebSecurity` 开启`Spring Security`配置，继承`WebSecurityConfigurerAdapter`的方法，实现个性化配置。如果使用内存配置用户，可以重写其中的`configure`方法进行配置，由于我们使用数据库中的用户信息，所以不需要在这里进行配置。并且采用认证服务器和资源服务器分离，也不需要在这里对服务资源进行权限的配置。

在类中创建了两个`Bean`，分别是用于处理认证请求的认证管理器`AuthenticationManager`，以及配置全局统一使用的密码加密方式`BCryptPasswordEncoder`，它们会在认证服务中被使用。

2、开启并配置认证服务器

```java
@Configuration
@EnableAuthorizationServer 
public class AuthorizationServerConfig extends AuthorizationServerConfigurerAdapter {
    @Autowired
    private AuthenticationManager authenticationManager;    //认证管理器
    @Autowired
    private BCryptPasswordEncoder passwordEncoder;//密码加密方式
    @Autowired
    private DataSource dataSource;  // 注入数据源
    @Autowired
    private UserDetailsService userDetailsService; //自定义用户身份认证

    @Bean
    public ClientDetailsService jdbcClientDetailsService(){
        //将client信息存储在数据库中
        return new JdbcClientDetailsService(dataSource);
    }

    @Bean
    public TokenStore tokenStore(){
        //对token进行持久化存储在数据库中，数据存储在oauth_access_token和oauth_refresh_token
        return new JdbcTokenStore(dataSource);
    }

    @Bean
    public AuthorizationCodeServices authorizationCodeServices() {
        //加入对授权码模式的支持
        return new JdbcAuthorizationCodeServices(dataSource);
    }

    @Override
    public void configure(ClientDetailsServiceConfigurer clients) throws Exception {
        //设置客户端的配置从数据库中读取，存储在oauth_client_details表
        clients.withClientDetails(jdbcClientDetailsService());
    }

    @Override
    public void configure(AuthorizationServerEndpointsConfigurer endpoints) throws Exception {
        endpoints
                .tokenStore(tokenStore())//token存储方式
                .authenticationManager(authenticationManager)// 开启密码验证，来源于 WebSecurityConfigurerAdapter
                .userDetailsService(userDetailsService)// 读取验证用户的信息
                .authorizationCodeServices(authorizationCodeServices())
                .setClientDetailsService(jdbcClientDetailsService());
    }

    @Override
    public void configure(AuthorizationServerSecurityConfigurer security) throws Exception {
        //  配置Endpoint,允许请求，不被Spring-security拦截
        security.tokenKeyAccess("permitAll()") // 开启/oauth/token_key 验证端口无权限访问
                .checkTokenAccess("isAuthenticated()") // 开启/oauth/check_token 验证端口认证权限访问
                .allowFormAuthenticationForClients()// 允许表单认证
                .passwordEncoder(passwordEncoder);   // 配置BCrypt加密
    }
}
```

在类中，通过`@EnableAuthorizationServer` 注解开启认证服务，通过继承父类`AuthorizationServerConfigurerAdapter`，对以下信息进行了配置：

- `ClientDetailsServiceConfigurer`：配置客户端服务，这里我们通过`JdbcClientDetailsService`从数据库读取相应的客户端配置信息，进入源码可以看到客户端信息是从表`oauth_client_details`中拉取。
- `AuthorizationServerEndpointsConfigurer`：用来配置授权（`authorization`）以及令牌（`token`）的访问端点，以及令牌服务的配置信息。该类作为一个装载类，装载了`Endpoints`所有的相关配置。

- `AuthorizationServerSecurityConfigurer`：配置令牌端点（`endpoint`）的安全约束，`OAuth2`开放了端点用于检查令牌，`/oauth/check_token`和`/oauth/token_key`这些端点默认受到保护，在这里配置可被外部调用。

3、采用从数据库中获取用户信息的方式进行身份验证

```java
@Service
public class UserDetailServiceImpl implements UserDetailsService {
    @Autowired
    private TbUserService userService;
    @Autowired
    private TbPermissionService permissionService;

    @Override
    public UserDetails loadUserByUsername(String userName) throws UsernameNotFoundException {
        TbUser tbUser = userService.getUserByUserName(userName);
        if (tbUser==null){
            throw new UsernameNotFoundException("username : "+userName+" is not exist");
        }

        List<GrantedAuthority> authorities=new ArrayList<>();
        //获取用户权限
        List<TbPermission> permissions = permissionService.getByUserId(tbUser.getId());
        permissions.forEach(permission->{
            authorities.add(new SimpleGrantedAuthority(permission.getEname()));
        });
        return new User(tbUser.getUsername(),tbUser.getPassword(),authorities);
    }
}
```

创建`UserDetailServiceImpl` 实现`UserDetailsService`接口，并实现`loadUserByUsername`方法，根据用户名从数据库查询用户信息及权限。

4、启动服务

首先发起请求获取授权码（code），直接访问下面的`url`：

```html
http://localhost:9004/oauth/authorize?client_id=client1&redirect_uri=http://localhost:8848/nacos&response_type=code&scope=select
```

看一下各个参数的意义：

`client_id`：因为认证服务器要知道是哪一个应用在请求授权，所以`client_id`就是认证服务器给每个应用分配的`id`

`redirect_uri`：重定向地址，会在这个重定向地址后面附加授权码，让第三方应用获取`code`

`response_type`：`code`表明采用授权码认证模式

`scope`：需要获得哪些授权，这个参数的值是由服务提供商定义的，不能随意填写

首先会重定向到登录验证页面，因为之前的`url`中只明确了第三方应用的身份，这里要确定第三方应用要请求哪一个用户的授权。输入数据库表`tb_user`中配置的用户信息 `admin/123456`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ee17de0a4ba641a5834533d4a996adc7~tplv-k3u1fbpfcp-zoom-1.image)

注意`url`中请求的参数必须和在数据库中的表`oauth_client`中配置的相同，如果不存在或信息不一致都会报错，在参数填写错误时会产生如下报错信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/37079173fbfa4852b1d4e06e8a867aa0~tplv-k3u1fbpfcp-zoom-1.image)

如果参数完全匹配，会请求用户向请求资源的客户端`client`授权：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dedbac45599e469dbf02cb018acdafb0~tplv-k3u1fbpfcp-zoom-1.image)

点击`Authorize`同意授权，会跳转到`redirect_uri`定义的重定向地址，并在url后面附上授权码`code`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a5656f0a0a654f0da76d4340ac1d4636~tplv-k3u1fbpfcp-zoom-1.image)

这样，用户的登录和授权的操作都在浏览器中完成了，接下来我们需要获取令牌，发送post请求到`/oauth/token`接口，使用授权码获取`access_token`。在发送请求时，需要在请求头中包含`clientId`和`clientSecret`，并且携带参数 `grant_type`、`code`、`redirect_uri`，这里会对`redirect_uri`做二次验证：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e7aeffb0fed74eebb295749f767bd5cc~tplv-k3u1fbpfcp-zoom-1.image)

这样，就通过`/oauth/token`端点获取到了`access_token`，并一同拿到了它的令牌类型、过期时间、授权范围信息，这个令牌将在请求资源服务器的资源时被使用。

#### 资源服务器

资源服务器简单来说就是资源的访问入口，主要负责处理用户数据的`api`调用，资源服务器中存储了用户数据，并对外提供`http`服务，可以将用户数据返回给经过身份验证的客户端。资源服务器和认证服务器可以部署在一起，也可以分离部署，我们这里采用分开部署的形式。

1、配置资源服务器

```java
@Configuration
@EnableResourceServer
public class ResourceConfig extends ResourceServerConfigurerAdapter {
    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    @Primary
    public RemoteTokenServices remoteTokenServices(){
        final RemoteTokenServices tokenServices=new RemoteTokenServices();
        //设置授权服务器check_token Endpoint 完整地址
        tokenServices.setCheckTokenEndpointUrl("http://localhost:9004/oauth/check_token");
        //设置客户端id与secret，注意：client_secret 值不能使用passwordEncoder加密
        tokenServices.setClientId("client1");
        tokenServices.setClientSecret("client-secret");
        return tokenServices;
    }

    @Override
    public void configure(HttpSecurity http) throws Exception {
        http.sessionManagement().sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED);
        http.authorizeRequests()
                .anyRequest().authenticated();
    }

    @Override
    public void configure(ResourceServerSecurityConfigurer resources) throws Exception {
        resources.resourceId("oauth2").stateless(true);
    }
}
```

在类中主要实现了以下功能：

- `@EnableResourceServer`注解表明开启`OAuth2`资源服务器，在请求资源服务器的请求前，需要通过认证服务器获取`access_token`令牌，然后在访问资源服务器中的资源时需要携带令牌才能正常进行请求
- 通过`RemoteTokenServices`实现自定义认证服务器，这里配置了我们之前创建的认证服务器

- 重写`configure(HttpSecurity http)`方法，开启所有请求需要授权才可以访问

- 配置资源相关设置`configure(ResourceServerSecurityConfigurer resources)`，这里只设置`resourceId`，作为该服务资源的唯一标识

2、测试接口，负责提供用户信息

```java
@RestController
public class TestController {
    @GetMapping("/user/{name}")
    public User user(@PathVariable String name){
        return new User(name, 20);
    }
}
```

3、启动服务

不携带`access_token`，直接访问接口`http://127.0.0.1:9005/user/hydra`:

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/55b3e3b289c84ebca277113546f7313b~tplv-k3u1fbpfcp-zoom-1.image)

使用Postman，在`Authorization`中配置使用`Bearer Token`，并填入从认证服务器获取的`access_token`（或在`Headers`中的`Authorization`字段直接填写`Bearer 'access_token'`）,再次访问接口，可以正常访问接口资源：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bb92c2b197ca448990ef309c5a996419~tplv-k3u1fbpfcp-zoom-1.image)



项目`Git`地址，欢迎大家给个star啊：

> https://github.com/trunks2008/oauth2



