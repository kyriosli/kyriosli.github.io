---
layout: post
title: "使用阿里云搭建动态dns"
date: "2016-06-27 12:04:00"
timezone: Asia/Hong_Kong
---

我最近在折腾私有云，之前比较头疼的一个问题是动态化IP地址的解析问题。目前好多ddns方案都或多或少存在一些问题，所以我把目光转向了私有域名+动态解析。

众所周知自建公网DNS服务器是很困难的，不但是搭建问题，还需要注册到根域名等。所以使用诸如阿里云等公共DNS服务器是明智的选择。而撸主的需求又
需要能够支持动态修改解析结果，恰好阿里云就有这个功能。

示例代码如下:

```sh
#!/bin/sh

if [ -f saved_ip ]
then . saved_ip
else saved_ip=""; record_id=""
fi

ip=`curl http://whatismyip.akamai.com/ 2>/dev/null`
if [ "$ip" = "$saved_ip" ]
then
    echo "skipping"
    exit 0
fi

name=home
domain=kyrios.pub
timestamp=`date -u "+%Y-%m-%dT%H%%3A%M%%3A%SZ"`
ak=你的阿里云app key
sk="你的阿里云app secret&"

urlencode() {
    # urlencode <string>

    local length="${#1}"
    i=0
    out=""
    for i in $(awk "BEGIN { for ( i=0; i<$length; i++ ) { print i; } }")
    do
        local c="${1:$i:1}"
        case $c in
            [a-zA-Z0-9._-]) out="$out$c" ;;
            *) out="$out`printf '%%%02X' "'$c"`" ;;
        esac
        i=$(($i + 1))
    done
    echo -n $out
}

send_request() {
    args="AccessKeyId=$ak&Action=$1&Format=json&$2&Version=2015-01-09"
    hash=$(urlencode $(echo -n "GET&%2F&$(urlencode $args)" | openssl dgst -sha1 -hmac $sk -binary | openssl base64))
    curl "http://alidns.aliyuncs.com/?$args&Signature=$hash" 2> /dev/null
}

get_recordid() {
    grep -Eo '"RecordId":"[0-9]+"' | cut -d':' -f2 | tr -d '"'
}

query_recordid() {
    send_request "DescribeSubDomainRecords" "SignatureMethod=HMAC-SHA1&SignatureNonce=$timestamp&SignatureVersion=1.0&SubDomain=$name.$domain&Timestamp=$timestamp"
}

update_record() {
    send_request "UpdateDomainRecord" "RR=$name&RecordId=$1&SignatureMethod=HMAC-SHA1&SignatureNonce=$timestamp&SignatureVersion=1.0&Timestamp=$timestamp&Type=A&Value=$ip"
}

add_record() {
    send_request "AddDomainRecord&DomainName=$domain" "RR=$name&SignatureMethod=HMAC-SHA1&SignatureNonce=$timestamp&SignatureVersion=1.0&Timestamp=$timestamp&Type=A&Value=$ip"
}

if [[ "$record_id" = "" ]]
then
    record_id=`query_recordid | get_recordid`
    if [[ "$record_id" = "" ]]
    then
        record_id=`add_record | get_recordid`
    else
        update_record $record_id
    fi
fi
# save to file
echo "record_id=$record_id; saved_ip=$ip" > saved_ip
```

这段代码可以在梅林自带的busybox里面运行，将脚本保存到文件系统中，并定时执行，就可以自动在IP变更时重新注册了。

[author|kyrios.li]