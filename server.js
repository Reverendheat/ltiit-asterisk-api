//Third party requirements
require('dotenv').config()
const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');

//Connect to MYSQL
const connection = mysql.createConnection({
    host     : process.env.DB_HOST,
    user     : process.env.DB_USER,
    password : process.env.DB_PASS,
    database : process.env.DB_NAME
});
connection.connect(function(err) {
    if (err) {
        console.error(`Error connecting to DB... ${err.stack}`);
        return;
    }
    console.log('Connected to Asterisk DB!');
});

//Create Express object and start server 
const app = express();
app.use(bodyParser.json());
app.listen(process.env.EXPRESS_PORT, () => console.log(`Asterisk API listening on port ${process.env.EXPRESS_PORT}!`));

//Default API route (http://asterisk.ltiit.local/api)
app.get('/api', function (req, res) {
    res.send("Hello from the Asterisk API!");
});

//Devices API route http://asterisk.ltiit.local/api/devices
app.route('/api/devices/')
    //Get all devices in database
    .get((req,res)=> {
        connection.query('SELECT DISTINCT category from asterisk.ast_config ORDER BY category;', function (error, results, fields) {
            if (error) throw error;
            res.send(results);
        });
    })
    //Insert new device into database
    .post((req, res) => {
        if (!('context' in req.body)) {
            return res.status(422).send('You need a context (default ltiit)');
        } else if (!('host' in req.body)) {
            return res.status(422).send('You need a host (default dynamic)');
        } else if (!('type' in req.body)) {
            return res.status(422).send('You need a type (default friend)');
        } else if (!('category' in req.body)) {
            return res.status(422).send('You need a category (device name)');
        } else {
            //Check to see if that category (device name exists)
            connection.query(`SELECT category from ast_config WHERE category LIKE '${req.body.category}'`, (error,results,fields) => {
                if (error) throw error;
                if (results.length < 1) {
                    //Lets insert it, but first check to see the max cat_metric is then increment it by 1, since it's not auto incrementing.
                    connection.query(`SELECT MAX(cat_metric) as current_max_cat_metric FROM ast_config;`,(error, results, fields) => {
                        if (error) throw error;
                        const current_max_cat_metric = JSON.stringify(results[0].current_max_cat_metric)
                        const new_max_cat_metric = parseInt(current_max_cat_metric) + 1
                        //Lets build the query, since their is a dynamic amount of keys coming in.
                        let values = "";
                        let var_metric = 0;
                        for (const key in req.body) {
                            if (key !== "category") {
                                values  += `(${new_max_cat_metric},${var_metric},'sip.conf','${req.body.category}','${key}','${req.body[key]}',0),`
                                var_metric++;
                            }
                        }
                        //Trim off the last comma to avoid insert MYSQL error
                        values = values.slice(0, -1);
                        //Alright now lets actually insert it
                        connection.query(`INSERT into ast_config 
                                            (cat_metric,var_metric,filename,category,var_name,var_val,commented)
                                        VALUES
                                            ${values};`,(error, results, fields) => {
                            if(error) throw error;
                            res.send(`Inserted ${req.body.category}, go ahead and check the db!`);
                        });
                    });
                } else {
                    //Already exists
                    res.send(`Sorry, ${req.body.category} already exists...`);
                }
            });
        }
    })
    //Update a device
    .put((req, res) => {
        res.send('Updating a device!')
    })
    //Delete a device based on categorey (Name)
    .delete((req,res) => {
        //Check to see if the device they are deleting even exists
        connection.query(`SELECT category from ast_config WHERE category LIKE '${req.body.category}';`, (error,results,fields)=>{
            if (error) throw error;
            if (results.length < 1) {
                res.send(`It doesn't look like ${req.body.category} exists...`)
            } else {
                connection.query(`DELETE FROM ast_config WHERE category LIKE '${req.body.category}';`, (error,results,fields) => {
                    res.send(`${req.body.category} is gone!`);
                })
            }
        });
    });


//Get single device route based on cat_metric
app.route('/api/devices/:cat_metric')
    .get((req, res) => {
        connection.query(`SELECT var_name, var_val from ast_config WHERE cat_metric LIKE ${req.params.cat_metric} ORDER BY category;`, function (error, results, fields) {
            if (error) throw error;
            if (!results.length) {
                return res.status(404).send(`It doesn't look like ${req.params.cat_metric} exists...`);
            }
            res.send(results);
        });
    })