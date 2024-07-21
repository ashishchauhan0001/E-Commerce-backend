import express from 'express'
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken'
import multer, { diskStorage } from 'multer'
import path from 'path'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv';

dotenv.config();


const port=process.env.PORT;
const app=express()

app.use(express.json()); 
app.use(cors()); // type of middleware which is used in connection of DB.

// Database conn with MongoDB ""
mongoose.connect(process.env.URL);

// API creation

app.get('/',(req,res)=>{
    res.send("Expree App is Running");
})

// Image storage engine
const storage=multer.diskStorage({
    destination:'./upload/images',
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})
const upload =multer({storage:storage})

// creating endPoint for upload image
app.use('/images',express.static('upload/images'))
app.post("/upload",upload.single('product'),(req,res)=>{
    res.json({
        success:1,
        image_url:`http://localhost:${port}/images/${req.file.filename}`
    })
})

// schema for the Database for products

const Product = mongoose.model('Product', new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true // Ensure each product has a unique id
    },
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    new_price: {
        type: Number,
        required: true
    },
    old_price: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now // Use Date.now as a function
    },
    available: {
        type: Boolean,
        default: true
    }
}));


app.post('/addproduct', async (req, res) => {
    let products=await Product.find({}); // all the db in products array
    let id; // automatic generated id for the document
    if(products.length>0){
        let last_product_array=products.slice(-1); // the last product
        let last_product=last_product_array[0];
        id=last_product.id+1;
    }else{
        id=1;
    }
    try {
        const product = new Product({
            id: id,
            name: req.body.name,
            image: req.body.image,
            category: req.body.category,
            new_price: req.body.new_price,
            old_price: req.body.old_price
        });

        console.log(product);
        await product.save();
        console.log("saved");

        res.json({
            success: true,
            name: req.body.name
        });
    } catch (error) {
        console.error("Error saving product:", error);
        res.status(500).json({
            success: false,
            message: "Failed to save product"
        });
    }
});

// creating API for deleting products

app.post('/removeproduct',async(req,res)=>{
   await Product.findOneAndDelete({id:req.body.id});
   console.log("Removed");
   res.json({
    success:1,
    name:req.body.name,
   })
})

// creating API for getting all products.
app.get('/allproducts',async(req,res)=>{
    let products= await Product.find({});
    console.log("All Products Fetched");
    res.send(products);

})

// Schema for User Model

const Users=mongoose.model('Users',{
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,
        required:true
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date,
        default:Date.now
    }
})

// Creating EndPoint for user registration.

app.post('/signup', async (req, res) => {
    let check = await Users.findOne({ email: req.body.email });
    if (check) {
        return res.status(400).json({ success: false, error: "User Already exists with same email address!" });
    }

    let cart = {};
    for (let i = 0; i < 300; i++) {
        cart[i] = 0; // get keys from 0 to 300
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: hashedPassword,
        cartData: cart,
    });

    await user.save();

    const data = {
        user: {
            id: user.id,
        }
    };
    const token = jwt.sign(data, process.env.SCERET_KEY);
    res.json({ success: true, token });
});

// creating EndPoints for userLogin
app.post('/login', async (req, res) => {
    let user = await Users.findOne({ email: req.body.email });
    if (user) {
        const passCompare =  bcrypt.compare(req.body.password, user.password);
        if (passCompare) {
            const data = {
                user: {
                    id: user.id
                }
            };
            const token = jwt.sign(data, process.env.SCERET_KEY);
            res.json({ success: true, token });
        } else {
            res.json({ success: false, errors: "Wrong Password, try again!" });
        }
    } else {
        res.json({ success: false, errors: "Wrong Email Address" });
    }

   
});

// creating endpoint for newollection data
app.get('/newcollections',async(req,res)=>{
    let products=await Product.find({});
    let newcollections=products.slice(1).slice(-8);
    console.log("NewCollection Fetched");
    res.send(newcollections);
})
// creating endPoint for the Popular in Women
app.get('/getPopular',async(req,res)=>{
    let product= await Product.find({category:"women"});
    let newData=product.slice(0,4);
    console.log("Data fetced for Popular in Women");
    res.send(newData);
})

//creating middleware to fetch user
 const fetchUser =async (req,res,next)=>{
    const token=req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"PLease Authenticate using valid token"})
    }else{
        try{
            const data=jwt.verify(token,process.env.SCERET_KEY);
            req.user=data.user
            next();
        } catch (error){
            res.status(401).send({errors:"please authenticate using valid token"})
        }
    }
 }

//creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser,async(req,res)=>{
    console.log("Added",req.body.itemId);

      let userData=await Users.findOne({_id:req.user.id});
      userData.cartData[req.body.itemId]+=1;
      await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
      res.send("Added");
})
// creating endPoint to remove product from cartdata
app.post('/removefromcart',fetchUser,async(req,res)=>{
    console.log("removed",req.body.itemId);
    let userData=await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId]-=1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Removed");
})

// creating endpoint to get cartdata after Login
app.post('/getcart',fetchUser,async(req,res)=>{
    console.log("GetCartAfterLogin");
    let userData=await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

app.listen(port,(error)=>{
    if(!error){
        console.log("Server is running on Port : ", port);
    }else{
        console.log("Error : "+error);
    }
})