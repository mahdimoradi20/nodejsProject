const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcryptjs");
const formidable = require("formidable")
const app = express();
const fs = require("fs");
const hbs = require("hbs");
const session = require('express-session');
app.use(session({
    secret: 'mytext',
    resave: true,
    saveUninitialized: true
}));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'hbs');
let users;
let connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'projectdb'
});

app.get("/", (req, res) => {
    if (req.session.user)
        res.redirect("/blog")
    else
        res.render("login");

});

let compareHash = (pass, hashedpass) => {
    return new Promise((resolve, reject) => {
        bcrypt.compare(pass, hashedpass, (err, res) => {
            if (err) reject(err);
            resolve(res);

        });
    });
}

app.post("/logincheck", (req, res) => {

    const username = req.body.username;
    const password = req.body.password;
    connection.query('select username,password,type from users', [], async (err, result, field) => {
        let flag = false;
        if (err) console.log(err)
        else {
            for (i = 0; i < result.length; i++) {
                if (result[i]['username'] == username) {
                    let hashedPassword = result[i]['password'];
                    let isTrueHash = await compareHash(password, hashedPassword);
                    if (isTrueHash) {
                        req.session.user = username;
                        req.session.type = result[i]['type'];
                        flag = true;
                    }
                }
            }
            if (flag)
                //res.render("index", { username: req.session.user, type: req.session.type });
                res.redirect("/blog");
            else
                res.render("login", { status: "نام کاربری یا رمز عبور اشتباه است!" });
        }
    });
});

let genHash = (password) => {
    return new Promise((resolve, reject) => {
        bcrypt.genSalt(10, (err, salt) => {
            if (err) reject(err);
            bcrypt.hash(password, salt, (err, hash) => {
                if (err) reject(err);
                resolve(hash);
            });
        });
    });
}


let checkUnic = (username) => {
    return new Promise((resolve, reject) => {

        connection.query("select * from users where username = '" + username + "' ", [], (err, result, field) => {
            flag = false;
            if (err) reject(err);
            else {
                if (result.length > 0) flag = true;
                resolve(flag);
            }
        });
    });
}

app.post("/submit", async (req, res) => {

    name = req.body.name;
    username = req.body.username;
    type = req.body.type;
    password = req.body.password
    let flag = await checkUnic(username);
    if (!flag) {

        let hash = await genHash(password);
        connection.query("insert into users (name,username,password,type) values(?,?,?,?)"
            , [name, username, hash, type],
            (err, result, field) => {
                if (err) console.log(err);
                else {
                    req.session.user = username;
                    req.session.type = type;
                    res.redirect("/");
                }
            });
    }
    else
        res.render("login", { status_submit: "کاربری با این نام از قبل موجود است!" });
});


app.get("/exit", (req, res) => {

    req.session.user = undefined;
    req.session.type = undefined;
    res.redirect("/");
});

app.get("/blog", (req, res) => {
    if (req.session.user) {
        connection.query("Select * from users,posts where posts.userid = users.userid order by date DESC", (err, result, field) => {
            if (err) console.log(err);
            else {
                connection.query("Select title,name,postid from users,posts where posts.userid = users.userid order by date DESC limit 5", [], (err2, latests, field2) => {
                    if (err2) console.log(err2);
                    res.render("blog", { data: result, topfivepost: latests });

                });
            }
        });
    }
    else
        res.render("login");
});


app.post("/search", (req, res) => {
    if (req.session.user) {
        connection.query("Select * from users,posts where posts.userid = users.userid  and title like '%" + req.body.searchphase + "%' order by date DESC", (err, result, field) => {
            if (err) console.log(err);
            else {
                connection.query("Select title,name from users,posts where posts.userid = users.userid order by date DESC limit 5", [], (err2, latests, field2) => {
                    if (err2) console.log(err2);
                    res.render("blog", { data: result, topfivepost: latests });

                });
            }
        });
    }
    else
        res.render("login");
});


app.get("/getpost", (req, res) => {
    if (req.session.user) {
        connection.query("Select * from posts where postid = " + req.query.id, (err, result, field) => {
            if (err) console.log(err)
            else {
                connection.query('SELECT username,commentText,commentdate from posts,comments,users where comments.postid = posts.postid and comments.userid = users.userid and posts.postid = ' + req.query.id + " order by commentdate DESC ",[],(err2,result2,field2)=>{
                    if(err2)console.log(err2);
                    else
                    {
                        res.render("blog-single", { data: result , comments : result2});
                    }
                });
            }
        });
    }
    else
        res.render("login");
});

app.get("/editor", (req, res) => {

    if (req.session.user) {
        if (req.session.type == "استاد") {
            process.env.username = req.session.user;
            res.render("editor");
        }
        else {
            res.send("شما اجازه دسترسی به این قسمت را ندارید!");
        }
    }
    else
        res.redirect("/");
});

let copyUploadedfile = (oldpath, newpath) => {

    return new Promise((resolve, reject) => {

        fs.copyFile(oldpath, newpath, (err) => {
            if (err) reject(err);
            else resolve(newpath);
        });
    });
}

let formatDate = (date) => {
    var year = date.getFullYear(),
        month = date.getMonth() + 1, // months are zero indexed
        day = date.getDate(),
        hour = date.getHours(),
        minute = date.getMinutes(),
        second = date.getSeconds(),
        hourFormatted = hour % 12 || 12, // hour returned in 24 hour format
        minuteFormatted = minute < 10 ? "0" + minute : minute,
        morning = hour < 12 ? "am" : "pm";
    if (morning == "pm")
        hourFormatted += 12;

    return year + "-" + month + "-" + day + " " + hourFormatted + ":" +
        minuteFormatted + ":" + second;
}

app.post("/addPost", (req, res) => {

    let username = req.session.user;
    var form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
        let picpath = files['picture']['path'];
        let filepath = files['file']['path'];
        let filename = files['file']['name'];
        let picname = files['picture']['name'];
        let newpicpath = __dirname + "/public/postfiles/" + files['picture']['name'];
        let newfilepath = __dirname + "/public/postfiles/" + files['file']['name'];
        if (files['picture']['size'] > 0) {
            if (files['picture']['type'].includes('image'))
                await copyUploadedfile(picpath, newpicpath);
            else
                res.render("editor", { info: '<span style = "border-style : solid;color : yellow; fontsize : 35px;background-color : red;" >فایل ارسالی برای  برای پست حتما باید از نوع تصویر باشد</span>' });
        }
        else
            picname = "default.jpg";
        if (files['file']['size'] > 0) {
            await copyUploadedfile(filepath, newfilepath);
        }
        else
            filename = "";
        connection.query("Select username,userid from users", [], (err2, results, field) => {

            for (i = 0; i < results.length; i++) {
                if (results[i]['username'] == username) {
                    console
                    const userid = results[i]['userid'];
                    const text = fields['text'];
                    const title = fields['title'];
                    let datetime = formatDate(new Date());
                    if (title == "")
                        res.render('editor', { info: '<span style = "border-style : solid;color : yellow; fontsize : 35px;background-color : red;" >عنوان نمیتواند خالی باشد</span>' });
                    connection.query("insert into posts (text,userid,title,path,attach,date) values(?,?,?,?,?,?)",
                        [text, userid, title, picname, filename, datetime], (err3, results2, field2) => {
                            if (err3) console.log(err3);
                            res.render("editor", { info: '<span style = "border-style : solid;color : black; fontsize : 35px;background-color : lightgreen;">پست با موفقیت ارسال شد!</span>' });
                        });
                    break;
                }
            }
        });

    });

});



app.post('/addComment',  (req, res) => {
    if (req.session.user) {
        let userid;
        let postid = req.body.pid;
        connection.query("Select * from users where username = '" + req.session.user + "'", [], (err, result, fields) => {
            if (err) console.log(err);
            else {
                userid = result[0]['userid'];
                let commentdate = formatDate(new Date())
                connection.query("insert into comments (commentText,postid,userid,commentdate) values (?,?,?,?)",
                 [req.body.commentTxt,postid,userid,commentdate] , (err2,results2,field2)=>{
                     res.redirect("/getpost?id="+postid);
                 });
            }
        });
    }
    else {
        res.redirect("/");
    }
});

console.log("App is running on Port 80...");
app.listen(80);