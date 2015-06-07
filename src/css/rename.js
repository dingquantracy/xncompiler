/**
 * 负责调用 clean-css 的 selectorParser
 * 将所有的css selector 名称重写
 */
var cleanCSS = require("clean-css");
var token = require("./token");
var parser = require("./selectorParser");
var util = require("../util");
var fs = require("fs");
var transHTMLTagName = require("./TransHtmlTag");

/**
 * cssAST 为一个数组
 * 每个元素有以下几种类型
 * 	一种 string 字符串 escape，block 等 special isSingle 也是，暂时不理解这个元素 注释等不能被解析的，也是字符串
 *   {selector:selector,body:body} 简单的.className{key:value} 类型   body 为string 类型
 *   {block:block,body:body} 针对@media 等块级嵌套元素  body 为数组，循环嵌套
 * 
 */


//可以屏蔽一些htmlTag的过滤
var htmlTagBackList = {};


//console.log(astToString(cssAST));


function cssRename(){
    this._init.apply(this,arguments);
}

cssRename.prototype = {
    _init:function(options){
        var that = this;
        this._options = util.extend({
            src:"", //css 原文件
            mangleNameOutputFile:null, //命名混淆map输出文件
            output:"",
            cssNamePrefix:"",
            cssHTMLTagPrefix:"xnCSS",
            cssHTMLTagBackList:["input","select"]
        },options);
        transHTMLTagName.setPrefix(this._options.cssHTMLTagPrefix);
        this._options.cssHTMLTagBackList.forEach(function(item,index,array){
            htmlTagBackList[item] = 1;
        });
        this.sourceMap = {};
        this.cssNameIndex = 0;
        util.base54_xn.reset();
        this._transFile(this._options.src,function(cssAST){
            that._transSelector(cssAST);
            var fileContent = that.astToString(cssAST);
            util.writeFile(that._options.output,fileContent,{encoding:"utf8"});
            if(that._options.mangleNameOutputFile){
                util.writeFile(that._options.mangleNameOutputFile,JSON.stringify(that.sourceMap),{encoding:"utf8"});
            }
            if(that._options.__xnCallBack){
                that._options.__xnCallBack();
            }
        });
    },
    _transFile:function(filePath,callBackFn){
        var context = {
            warnings:[]
        };
        var testData = fs.readFileSync(filePath);
        //首先去除css 中的注释，否则token 会有解析错误
        var trimData = testData.toString().replace(/\/\*+([^*]|\r|\n|(\*+([^*/]|[\r\n])))*\*+\//gi,"");
        var tokenT = token(trimData,context);
        var cssAST = tokenT.process();
        if(callBackFn){
            callBackFn(cssAST);
        }
    },
    _transSelector:function(cssAST){
        for(var i= 0,l=cssAST.length;i<l;i++){
            var item = cssAST[i];
            if(item&&item.selector){
                var sAST = parser(item.selector);
                var sStr = this._transSASTtoString(sAST.tokenArray);
                if(sStr != item.selector){
                    //console.log(item.selector);
                    //console.log(item.selector,"~~~~~~~~~~~~~~~~~~~",sStr);
                    item.selector = sStr;
                }
                //console.log(Object.prototype.toString.apply(item.body));
            }else{
                if(item.block&&item.body&&item.body.length>0){
                    this._transSelector(item.body);
                }else{
                    //console.log(Object.prototype.toString.apply(item));
                    //console.log(item);
                }
            }
        }
    },
    _strNum:function(str){
    	if(!this.sourceMap["className"]){
    		this.sourceMap["className"] = {};
    	}
    	var root = this.sourceMap["className"];
        if(!root[str]){
            var name = str;
            if(this._options.mangleNameOutputFile){
                name = util.base54_xn(this.cssNameIndex++);
            }
            root[str] = this._options.cssNamePrefix+name;
        }
        return root[str];
    },
    _transSASTtoString:function(sAST){
        var rs = [];
        for(var i= 0,l=sAST.length;i<l;i++){
            var item = sAST[i];
            if(item.type == "className"){
                //rs.push("."+item.text);
                rs.push("."+this._strNum(item.text));
            }else if(item.type == "htmlTag"){
                //if(item.text = "isindex"){
                    //console.log(item,htmlTagBackList[item.text]?item.text:transHTMLTagName(item.text));
                //}
            	if(!this.sourceMap["htmlTag"]){
            		this.sourceMap["htmlTag"] = {};
            	}
            	var root = this.sourceMap["htmlTag"];
            	if(!htmlTagBackList[item.text]){
            		if(!root[item.text]){
            			root[item.text] = transHTMLTagName(item.text);
            		}
            	}
                rs.push(htmlTagBackList[item.text]?item.text:"."+root[item.text]);
            	 /*rs.push(htmlTagBackList[item.text]?item.text:transHTMLTagName(item.text));*/
            }else if(item.type == "other"){
                rs.push(item.text);
            }else if(item.type == "subScope"){
                if(item.data){
                    var _rs = this._transSASTtoString(item.data);
                    rs.push("("+_rs+")");
                }
            }else{
                console.log("unKnowType",item);
            }
        }
        return rs.join("");
    },
    //将语法树还原成css 文件
    astToString:function(ast){
        if(Object.prototype.toString.apply(ast) == "[object Array]"){
            var rs = [];
            for(var i = 0,l=ast.length;i<l;i++){
                var item = ast[i];
                if(item&&item.selector&&item.body){
                    rs.push(item.selector+"{"+item.body+"}");
                }else if(item&&item.block&&item.body){
                    rs.push(item.block+"{"+this.astToString(item.body)+"}");
                }else{
                    rs.push(item);
                    //console.log(item,"=========");
                }
            }
            return rs.join("\r\n");
        }else{
            return ast;
        }
    }
}

module.exports = cssRename;