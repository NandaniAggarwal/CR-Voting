if(process.env.NODE_ENV !=="production"){
    require('dotenv').config();
}

// Importing required modules
const express=require('express');
const mongoose= require('mongoose');
const path=require('path');
const joi=require('joi');
const session=require('express-session');
const flash=require('connect-flash');
const passport=require('passport');
const localstrategy=require('passport-local').Strategy;
const multer  = require('multer');
const ejsmate=require('ejs-mate');
const methodoverride=require('method-override');
const {storage}=require('./cloudinary/app');
const upload = multer({storage});
const { stringify } = require('querystring');
const { isLoggedIn }=require('./middleware');
const { storeReturnTo } = require('./middleware');
const catchasync=require('./utilities/catchasync');
const expresserror=require('./utilities/expresserror');
const User=require('./models/userSchema');
const Candidate=require('./models/candidateSchema');
const Feedback=require('./models/feedbackSchema');
const nodemailer = require("nodemailer");
const { authenticator }=require('otplib');

//let total_votes=0;

// Create a new Express application
const app=express();


// Set up secret key for session encryption
const secret = process.env.SECRET || 'thisshouldbeabettersecret!';
// Set up database connection URL
const dburl = process.env.DB_URL || 'mongodb://127.0.0.1:27017/voting';


//mongoose conection
mongoose.connect(dburl);
main().catch(err => console.log(err));
async function main() {
  await mongoose.connect(dburl);
   console.log("connection made");
}

// Connect to MongoDB database
const MongoDBStore=require('connect-mongo');
// Set up session store using MongoDB
const store = new MongoDBStore({
    mongoUrl: dburl,
    secret,
    touchAfter: 24 * 60 * 60
});
// Set up event listener for session store errors
store.on("error", function (e) {
    console.log("SESSION STORE ERROR", e)
})
store.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});
  
  
// Set up session configuration
const sessionconf = {
    store,
    name: 'session',
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(express.json()); 
// Set up session middleware
app.use(session(sessionconf)); 
// Set up view engine and views directory
app.set('views',path.join(__dirname,'views'));
app.set('view engine','ejs');

// Set up EJS template engine with additional features
app.engine('ejs',ejsmate);

// Set up middleware for parsing URL-encoded requests
app.use(express.urlencoded({extended:true}));

// Set up middleware for overriding HTTP methods
app.use(methodoverride('_method'))

// Set up middleware for serving static files
app.use(express.static(path.join(__dirname,'public')))

// Set up flash message middleware
app.use(flash());

// Set up Passport.js middleware
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localstrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req,res,next)=>{
    res.locals.currentuser=req.user;
    res.locals.success=req.flash('success');
    res.locals.error=req.flash('error');
    next();
})

// Home page where user have two options to login/ register
app.get('/',async (req,res)=>{
    res.render('home');
});


function validateCollegeEmail(req, res, next) {
    const email = req.body.email;
    const emailPattern = /^[a-zA-Z]+(079|08[0-9]|09[0-9]|1[0-5][0-9])(?<!157|158|159)btcseai24@igdtuw\.ac\.in$/;
    if (emailPattern.test(email)) {
        next();
    } else {
        req.flash('error', "Please enter a valid college email");
        res.redirect('/register');
    }
}

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


//**************************************************************************** */

// Route to send OTP
app.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    console.log("Received email:", email);
    if (!email) {
        return res.status(400).json({ success: false, message: "Email is required." });
    }
    const otp = authenticator.generate(process.env.OTP_SECRET);
    const otpExpires = Date.now() + 10 * 60 * 1000; // Generate OTP
    req.session.otp = otp;
    req.session.otpEmail = email;
    req.session.otpExpires = otpExpires; 

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP for Registration",
        text: `Your OTP is: ${otp}. It is valid for 10 minutes.`
    };

    try {
        console.log("Mail Options:", mailOptions);
        await transporter.sendMail(mailOptions);
        return res.json({ success: true, message: "OTP sent successfully!" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Failed to send OTP." });
    }
});

// Route to verify OTP
app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (Date.now() > req.session.otpExpires) {
        delete req.session.otp;
        return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }
    if (req.session.otpEmail === email && req.session.otp === otp) {
        req.session.otpVerified = true;
        return res.json({ success: true, message: "OTP verified successfully!" });
    } else {
        return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }
});

app.get('/register',catchasync(async (req,res)=>{
    res.render('users/register');
}));
// Registration Route
app.post('/register',validateCollegeEmail,catchasync( async (req, res) => {
    try {
        const { username, password, email } = req.body;
        if (!req.session.otpVerified) {
            req.flash('error', "Please verify your OTP first.");
            return res.redirect('/register');
        }

        const user = new User({ username:email,email });
        const registeredUser = await User.register(user, password);
        
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash('success', 'Welcome to CR Voting Platform');
            res.redirect('/currentCR');
            req.session.otp = null;
            req.session.otpExpires = null;
            req.session.otpEmail = null;
            req.session.otpVerified = null;
        });
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/register');
    }
}));


//*******************************************************************************
/*
// Page to Register if user has not created account in CR voting system
app.get('/register',catchasync(async (req,res)=>{
    res.render('users/register');
}));
app.post('/register',validateCollegeEmail,catchasync(async (req,res)=>{
    try{
        const {username,password,email}=req.body;
        const user= new User({username,email})
        const registereduser= await User.register(user,password);
        req.login(registereduser,err=>{
            if(err) return next(err);
            req.flash('success','Welcome to CR Voting Platform');
            res.redirect('/currentCR');
        })
    }catch(e){
        req.flash('error',e.message);
        res.redirect('/register');
    }
}));
*/
//**************************************************************************** */

// Page to Login and verify that user belongs to that class or not
app.get('/login',catchasync(async (req,res)=>{
    res.render('users/login');
}));
app.post('/login',storeReturnTo,passport.authenticate('local',{failureFlash:"Email or Password is incorrect",failureRedirect:'/login'}),catchasync(async (req,res)=>{
    req.flash('success','Welcome back');
    const redirectedUrl=res.locals.returnTo || '/currentCR';
    res.redirect(redirectedUrl);
}));



app.get('/currentCR',isLoggedIn,catchasync(async(req,res)=>{
    const candidate= await Candidate.find({});
    res.render('voting/currentCR',{ candidate });
}))


app.get('/candidate',isLoggedIn,catchasync(async(req,res)=>{
    res.render('voting/candidate');
}))
app.post('/candidate',isLoggedIn,upload.array('image'),catchasync(async(req,res)=>{
        const {name,description,whyq,image}=req.body;
        const candidate= new Candidate({name,description,whyq,image});
        if (req.files) {
            candidate.images = req.files.map((file) => ({ url: file.path, filename: file.filename }));
        }        
        candidate.votes=0;
        await candidate.save();
        req.flash('success','Form filled successfully! Now You are a candidate');
        res.redirect('/vote');
}));



app.get('/vote',isLoggedIn,catchasync(async(req,res)=>{
    const candidate= await Candidate.find({});
    const user = req.user;
    if (isNaN(user.noOfVotes)) {
        user.noOfVotes = 0;
    }
    const noOfVotesdone=req.user.noOfVotes;
    //const votedCandidatesarr=req.user.votedCandidates;
    res.render('voting/vote',{ candidate,noOfVotesdone ,user});
}));
app.post('/vote/:id', async (req, res) => {
    try {
      const candidateId = req.params.id;
      const userId = req.user._id; 
      const user = await User.findById(userId);
      if (isNaN(user.noOfVotes)) {
        user.noOfVotes = 0;
      }
      if (user.noOfVotes===3) {
        req.flash('error','You have already voted 3 times');
        return res.redirect('/vote'); 
      }
      const candidate = await Candidate.findById(candidateId);
      if (!candidate) {
        return res.status(404).send('Candidate not found');
      }
      candidate.votes += 1; 
      await candidate.save(); 
      user.noOfVotes+=1;
      user.votedCandidates.push(candidateId);
      await user.save();
      req.flash('success','You vote has been counted');
      res.redirect('/vote');
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error');
    }
});

async function getTotalVotes() {
    let total_vote=0;
    const candidates = await Candidate.find({});
    for (const candidate of candidates) {
      total_vote += candidate.votes;
    }
    return total_vote;
}
  

app.get('/liveresult',isLoggedIn,catchasync(async(req,res)=>{
    const candidate=await Candidate.find({});
    let total_votes=await getTotalVotes();
    res.render('voting/liveresult',{candidate,total_votes});
}))
app.get('/dates',isLoggedIn,catchasync(async(req,res)=>{
    res.render('voting/dates');
}))

app.get('/feedback',isLoggedIn,catchasync(async(req,res)=>{
    const feedbacks= await Feedback.find({}).populate('author');;
    res.render('voting/feedback',{feedbacks});
}))
app.post('/feedback',isLoggedIn,catchasync(async (req,res)=>{
    console.log(req.body);
    const {body,rating}=req.body;
    if (!body || !rating) {
        return res.status(400).send('Both body and rating are required.');
    }
    const feedback= new Feedback({body,rating});
    //const feedback = new Feedback({body:req.body.body, rating: req.body.rating });
    feedback.author=req.user._id;
    await feedback.save();
    console.log(feedback)
    req.flash('success','Successfully posted Feedback!');
    res.redirect('/feedback');
}))


// For logging out 
app.get('/logout',isLoggedIn,(req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash('success', 'Goodbye!');
        res.redirect('/');
    });
}); 


const port = process.env.PORT || 10000; // Set up port number for the application

// Starting the application and listening on the specified port
app.listen(port, () =>{
    console.log(`serving on port ${port}`);
});
