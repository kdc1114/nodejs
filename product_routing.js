const http=require("http");
const url=require("url");
const fs=require("fs");
const mysql=require("mysql");
const login_info={
    host: "127.0.0.1",
    port: 3306,
    user: 'root',
    password: 'mysql',
    database: 'shop'
};
const READ_SQL=`SELECT P.*,C.NAME CATEGORY 
                FROM PRODUCT P INNER JOIN CATEGORY C
                USING(CATEGORY_NUM)`;
const READ_DETAIL_SQL=`SELECT P.*,C.NAME CATEGORY 
                FROM PRODUCT P INNER JOIN CATEGORY C
                USING(CATEGORY_NUM) WHERE PRODUCT_NUM=?`;
const READ_CATEGORY_SQL="SELECT * FROM CATEGORY";
const DELETE_SQL="DELETE FROM PRODUCT WHERE PRODUCT_NUM=?";
const UPDATE_SQL=`  UPDATE PRODUCT SET
                    NAME=?, TITLE=?, COUNT=?, PRICE=?, COLOR=?, MODEL_NUM=?,CATEGORY_NUM=?
                    WHERE PRODUCT_NUM=?`;
const COMMENT_LIST_SQL=`SELECT * FROM PRODUCT_COMMENT WHERE PRODUCT_NUM=?`

http.createServer(async (req,res)=>{
    console.log(req.url+"요청이 들어왔습니다.");
    const url_parse=url.parse(req.url,true);
    if(url_parse.pathname === "/" || url_parse.pathname === "/index.html"){
        let data = await fsData("./public/index.html");
        res.end(data);
    }else if(url_parse.pathname === "/item/list.do"){
        let data = await fsData("./public/product_list.html")
        let list = await mysqlQuery(READ_SQL,[]);
        console.log(list["result"]);
        res.write(`<script>const PRODUCT_LIST=${JSON.stringify(list["result"]) }; console.log(PRODUCT_LIST)</script>`);
        list["conn"].end((e)=>{console.log("리스트 완료");});
        res.end(data);
    // 리소스 path : /public/img/123.jpg.split("/") => ["." , "public" , "img" , "123.jpg"]
    }else if(url_parse.pathname === "/item/detail.do"){
        let data = await fsData("./public/product_detail.html");
        let result_obj=mysqlQuery(READ_DETAIL_SQL,[url_parse.query.id]);
        let cate_result_obj=mysqlQuery(READ_CATEGORY_SQL);
        data = await data; 
        result_obj = await result_obj;
        cate_result_obj = await cate_result_obj;
        res.write(`<script>
            const PRODUCT=${JSON.stringify(result_obj['result'][0])};
            const CATE_LIST=${JSON.stringify(cate_result_obj['result'])};
            </script>
        `);
        res.end(data);
        result_obj["conn"].end((e)=>{});
        cate_result_obj["conn"].end((e)=>{});
    }else if(url_parse.pathname === "/item/delete.do"){
        let result={affectedRows:0, msg:"없는 레코드입니다."};
        try{
            let delete_obj = mysqlQuery(DELETE_SQL,[url_parse.query["id"]]);
            result.affectedRows=delete_obj["result"].affectedRows;
            if(result.affectedRows>0){result.msg="레코드 삭제 성공"};
            delete_obj["conn"].end((e)=>{});
        }catch(e){
            result.affectedRows=-1
            result.msg="참조하고 있는 레코드가 있거나 통신장애로 오류가 발생";
            console.error(e.msg);
        }
        res.setHeader("Content-Type","application/json;charset=UTF-8");
        res.end(JSON.stringify(result));
    }else if(url_parse.pathname === "/item/update.do" && req.method==="POST"){
        let post_data=""; // undefined+"a" = undefineda로 오기때문에 ""작성
        await req.on("data",(data)=>{post_data+=data;}); // 복수로 오는 data를 반복실행하는 반복문
        // await로 on("end",()=>{}) 생략
        const post_obj=JSON.parse(post_data);
        const result={affectedRows:0,msg:"삭제된 레코드"};
        try{
            const result_obj=await mysqlQuery(UPDATE_SQL,
                [post_obj.NAME,post_obj.TITLE,post_obj.COUNT,post_obj.PRICE,
                post_obj.COLOR,post_obj.MODEL_NUM,post_obj.CATEGORY_NUM,
                post_obj.PRODUCT_NUM]);
                result.affectedRows=result_obj.result.affectedRows;
                if(result.affectedRows>0){result.msg="수정.페이지를 새로고침합니다."};
                result_obj.conn.end((e)=>{});
        }catch(e){
            result.affectedRows=-1; result.msg=e.msg;
        };
        res.setHeader("Content-Type","application/json;charset=UTF-8");
        res.write(JSON.stringify(result));
        res.end();
    }else if(url_parse.pathname === "/item/comment/list.do"){
        let result=await mysqlQuery(COMMENT_LIST_SQL
            ,[url_parse.query["product_num"]]);
        res.setHeader("Content-Type","application/json;charset=UTF-8");
        res.write(JSON.stringify(result["result"]));
        res.end();
        result["conn"].end((e)=>{});
    }else if(url_parse.pathname.split("/")[1] === "public"){
        if(url_parse.pathname.split("/")[2] === "img"){
            try{
                // "/" 절대경로 사용시 c://public 으로 사용됨
                // "./" 상대경로 사용시 shop/public
                let img=await fsData("."+url_parse.pathname);
                res.setHeader("Content-Type","image/jpeg")
                res.write(img);
                res.end();
            }catch(e){
                console.error(e);
                res.statusCode=404;
                res.end("찾을 수 없는 이미지");
            }
        }else if(url_parse.pathname.split("/")[2] === "css"){

        }else if(url_parse.pathname.split("/")[2] === "js"){

        };
    }
}).listen(3456,()=>{
    console.log("http://127.0.0.1:3456 or 127.0.0.1:3456/index.html");
});
function fsData(url){
    return (new Promise((resolve,reject)=>{
        fs.readFile(url,(e,data)=>{
            resolve(data);
        })
    }));
};

function mysqlQuery(sql,param_arr=[]){
    return (new Promise((resolve,reject)=>{
        const create_conn=mysql.createConnection(login_info);
        resolve(create_conn);
    }).then((conn)=>{
        return new Promise((resolve,reject)=>{
            conn.connect((e)=>{
                if(e){conn.end((e)=>{}); throw new Error(e);};
                resolve(conn);
            });
        });
    }).then((conn)=>{
        return new Promise((resolve,reject)=>{
            conn.query(sql,param_arr,(e,result)=>{
                if(e){conn.end((e)=>{}); throw new Error(e);};
                resolve({'result':result,'conn':conn});
            });
        })
    })
    );
}