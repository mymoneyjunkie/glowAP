const express = require('express');

const { body, validationResult } = require("express-validator");

const axios = require('axios');

const FormData = require('form-data');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

const baseUrl = 'https://glowbal.co.uk/api/';

const isAuth = require("../middleware/is_auth");

// const baseUrl2 = 'https://glowbal.co.uk/api/';

const getData = (url, method, data = null) => {
  let config = {
    method: method,
    maxBodyLength: Infinity,
    url: baseUrl + url,
    headers: {},
  };

  // console.log(method.toLowerCase());

  if (method.toLowerCase() === "post" && data) {
    const formData = new FormData();
    for (const key in data) {
      formData.append(key, data[key]);
    }
    config.data = formData;
    config.headers = { ...formData.getHeaders() }; // Set headers for form data
  }

  return config;
};

const getData2 = (method, data = null) => {
  let config = {
    method: method,
    maxBodyLength: Infinity,
    url: baseUrl,
    headers: {},
  };

  // console.log(method.toLowerCase());

  if (method.toLowerCase() === "post" && data) {
    const formData = new FormData();
    for (const key in data) {
      formData.append(key, data[key]);
    }
    config.data = formData;
    config.headers = { ...formData.getHeaders() }; // Set headers for form data
  }

  return config;
};

router.get("/v1/home", isAuth, async (req, res, next) => {
	try {
		const pgno = parseInt(req.query.pgno) || 1;

		let offset = 0;

		offset = pgno == 1 ? 0 : 5 * (pgno - 1);

		// console.log(pgno, offset);

		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}
		else {
			message = null;
		}

		const postData = { 'offset': offset };
		const response = await axios.request(getData("get/home.php", "post", postData));
		const data = response.data;

		// console.log(data);

		const seasonCount = data && data.length >= 1 ? await Promise.all(data.map(async (i) => {
		    const postData2 = { 'videoId': i.videoId };
		    const response2 = await axios.request(getData("get/videoSeasonCount.php", "post", postData2));
		    const data2 = response2.data;
      
        // console.log(data2);

		    return {
		        id: i.videoId,
            sno: data2.map(j => j.season_number),
		        count: data2.length
		    };
		})) : [];

		// console.log(seasonCount);

		const mergedData = data.map(item => {
		  const match = seasonCount.find(d => d.id === item.videoId);
		  return {
		    ...item,
        sno: match ? match.sno : [],
		    count: match ? match.count : '0' // Add count if match exists, else default to '0'
		  };
		});

		// console.log(mergedData);

		return res.render("home", {
			title: "Home",
			errorMessage: message,
			data: mergedData,
			currentPage: pgno
		})
	}
	catch(error) {
		console.log("home error", error);
	}
})

router.get("/v1/add", isAuth, async (req, res, next) => {
	try {
		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}
		else {
			message = null;
		}

		return res.render("add2", {
			title: "Add Movies",
			// edit: false,
			editing: false,
			errorMessage: message,
			oldInput: {
				title: '',
  			description: '',
  			portrait_image: '',
  			fileCode: '',
  			video_length: ''
			},
		})
	}

	catch(error) {
		console.log("add movies get error", error);
	}
})

router.post("/v1/add",
	[
		body('title')
			.trim()
			.notEmpty()
			.withMessage('Title is required.')
			.matches(/^[^<>]*$/)
			.withMessage('Invalid Title...'),
	  	body("description")
	  		.trim()
	  		.notEmpty()
	  		.withMessage("Description is required")
	  		.matches(/^[^<>]*$/)
	  		.withMessage('Invalid Description...'),
	  	body("portrait_image").trim().notEmpty().withMessage("Portrait Image is required").escape(),
	  	body("fileCode").trim().notEmpty().withMessage("Video is required").escape(),
	  	body("video_length")
	  		.trim()
	  		.notEmpty()
	  		.isNumeric() // Ensure it contains only numbers
    		.withMessage("Video length must be a number.")
	],
	async (req, res, next) => {
		try {
			// console.log(req.body);

			const { title, description, portrait_image, fileCode, video_length } = req.body;

			// console.log(title, description, logo, portrait_image, fileCode);
			// console.log(typeof title, typeof description, typeof portrait_image, typeof fileCode);

			const cleanedTitle = title.trim();
			const cleanedDescription = description.trim();

			// console.log(req.body, cleanedTitle, cleanedDescription);

			// ${(oldInput.description && oldInput.description[index-1]) || ''}

			const error = validationResult(req);

	    if (!error.isEmpty()) {
				// console.log(error.array());

				let msg1 = error.array()[0].msg;

				return res.render("add2", {
					title: "Add Movies",
					// edit: false,
					editing: false,
					errorMessage: msg1,
					oldInput: {
						title: cleanedTitle,
		  			description: cleanedDescription,
		  			portrait_image: portrait_image,
		  			fileCode: fileCode,
		  			video_length: video_length
					}
				})
			}

			else {
				let data = JSON.stringify({
				  	"title": title,
				  	"description": description,
				  	"image": portrait_image,
				  	"video": fileCode,
				  	"video_length": video_length
				});

				let config = {
				  	method: 'post',
				  	maxBodyLength: Infinity,
				  	url: baseUrl + 'insert/video.php',
				  	headers: { 
				  	  'Content-Type': 'application/json'
				  	},
				  	data : data
				};

				const response1 = await axios.request(config);
				const data1 = response1.data;

				// console.log(data1);

				if (data1 && data1.isSuccess == true) {
					return res.redirect("/v1/home");
				}
				else {
					req.flash('error', 'Failed to Add Movie... Try Again...');
					return res.redirect("/v1/add");
				}
			}
		}

		catch(error) {
			console.log("post add movie ", error);
		}
	}
)

router.get("/v1/add2", isAuth, async (req, res, next) => {
	try {
		// console.log(req.query);
		const { id } = req.query;

		// console.log(id);

		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}
		else {
			message = null;
		}

		return res.render("add3", {
			title: "Add Series",
			// edit: false,
			editing: false,
			errorMessage: message,
			oldInput: {
				id: id,
				season: '',
				stitle: '',
				sdescription: '',
				title: [],
  			description: [],
  			portrait_image: [],
  			fileCode: [],
  			video_length: [],
			},
			count: 1
		})
	}

	catch(error) {
		console.log("add series get error", error);
	}
})

router.post("/v1/add2",
	[
		body('stitle')
			.trim()
			.notEmpty()
			.withMessage('Season Title is required.')
			.matches(/^[^<>]*$/)
			.withMessage('Invalid Season Title...'),
	  body("sdescription")
	  	.trim()
	  	.notEmpty()
	  	.withMessage("Season Description is required")
	  	.matches(/^[^<>]*$/)
	  	.withMessage('Invalid Season Description...'),
	  body("id")
      .trim()
      .notEmpty()
      .isNumeric()
      .withMessage("Id is required")
      .custom(value => {
        if (value == 0) {
          throw new Error("Id is required");
        }
        return true; // indicate success
      }),
	  body("season")
	  	.trim()
	  	.notEmpty()
	  	.isNumeric() // Ensure it contains only numbers
    	.withMessage("Season Number must be a number."),
    // Custom validation for empty arrays
    body('title')
      .custom(value => {
        // Check if the value is either a string or an array
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Title must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(title => title.trim() === '')) {
            throw new Error('Episode Title must not be empty.');
          }
        } else {
          throw new Error('Episode Title must be a string or an array.');
        }
        return true;
        
      // .custom(value => {
      //   if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
      //     throw new Error('Episode Title must not be empty.');
      //   }
      //   return true;
    }),

    body('description')
      .custom(value => {
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Description must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(img => img.trim() === '')) {
            throw new Error('Episode Description must not be empty.');
          }
        } else {
          throw new Error('Episode Description must be a string or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Description must not be empty.');
        // }
        // return true;
    }),

    body('portrait_image')
      .custom(value => {
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Image must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(img => img.trim() === '')) {
            throw new Error('Episode Image must not be empty.');
          }
        } else {
          throw new Error('Episode Image must be a string or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Image must not be empty.');
        // }
        // return true;
    }),

    body('fileCode')
      .custom(value => {
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Video must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(img => img.trim() === '')) {
            throw new Error('Episode Video must not be empty.');
          }
        } else {
          throw new Error('Episode Video must be a string or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Video must not be empty.');
        // }
        // return true;
   	}),

    body('video_length')
      .custom(value => {
        if (typeof value === 'number') {
          if (value <= 0) {
          	throw new Error('Episode Video length must not be empty and a positive number.');
          }
        } else if (Array.isArray(value)) {
          // if (value.length === 0 || value.some(img => img.trim() === '')) {
        	if (value.length === 0 || value.some(dur => typeof dur !== 'number' || dur <= 0)) {
            throw new Error('Episode Video length must not be empty.');
          }
        } else {
          throw new Error('Episode Video length must be a number or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Video length must not be empty.');
        // }
        // return true;
    	}),
	],
 	async (req, res, next) => {
		try {
			// console.log(req.body);

			const { id, season, stitle, sdescription, title, description, portrait_image, fileCode, video_length } = req.body;

			// console.log(title, description, portrait_image, fileCode);
			// console.log(typeof title, typeof description, typeof logo, typeof portrait_image, typeof fileCode);

			const cleanedTitle = (typeof title == 'object') ? title.map(i => i.trim()) : [title.trim()];
			const cleanedDescription = (typeof description == 'object') ? description.map(i => i.trim()) : [description.trim()];
			const csDes = sdescription.trim();
			const pi = (typeof portrait_image == 'object') ? portrait_image : [portrait_image];
			const fc = (typeof fileCode == 'object') ? fileCode : [fileCode];
			const vl = (typeof video_length == 'object') ? video_length : [video_length];

			// console.log(cleanedTitle, cleanedDescription);

			const error = validationResult(req);

	    if (!error.isEmpty()) {
				// console.log(error.array());

				let msg1 = error.array()[0].msg;

				return res.render("add3", {
					title: "Add Series",
					// edit: false,
					editing: false,
					errorMessage: msg1,
					oldInput: {
						id: id,
						season: season,
						stitle: stitle,
						sdescription: csDes,
						title: cleanedTitle,
		  			description: cleanedDescription,
		  			portrait_image: pi,
		  			fileCode: fc,
		  			video_length: vl
					},
					count: cleanedTitle.length >= 1 ? cleanedTitle.length : 1
				})
			}

			else {
				let data = JSON.stringify({
				  "video_id": id,
				  "season_number": season,
				  "title": stitle,
				  "description": csDes,
				  "ep_title": cleanedTitle,
				  "ep_description": cleanedDescription,
				  "ep_image": pi,
				  "ep_video": fc,
				  "ep_video_length": vl
				});

				let config = {
				  method: 'post',
				  maxBodyLength: Infinity,
				  url: baseUrl + 'insert/season.php',
				  headers: { 
				    'Content-Type': 'application/json'
				  },
				  data : data
				};

				const response1 = await axios.request(config);
				const data1 = response1.data;

				// console.log(data1);

				if (data1 && data1.isSuccess == true) {
					return res.redirect("/v1/home");
				}
				else {
					req.flash('error', 'Failed to Add Season... Try Again...');
					return res.redirect(`/v1/add2/?id=${id}`);
				}
			}
		}

		catch(error) {
			console.log("add series error ", error);
			return res.redirect("/v1/home");
		}
	}
)

router.post("/v1/delete", async (req, res, next) => {
	try {
		// console.log(req.body.id);
		const { id } = req.body;

		const postData = { "id": id };
		const response1 = await axios.request(getData("delete/video.php", "post", postData));
		const data1 = response1.data;
    
    if (data1.isSuccess) {
      return res.redirect("/v1/home");
    }
    else {
      return req.flash("error", "Failed to delete. Try again...");
		  return res.redirect("/v1/home");
    }
	}

	catch(error) {
		req.flash('error', "Failed to delete... Try Again...");
		return res.redirect("/v1/home");
	}
})

router.get("/v1/edit/:id", isAuth, async (req, res, next) => {
	try {
		const { id } = req.params;

		// console.log(id);

		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}
		else {
			message = null;
		}

		const postData = { "id": id };
		const response1 = await axios.request(getData("get/videos.php", "post", postData));
		const data1 = response1.data;

		// console.log(data1);

		return res.render("add2", {
			title: "Edit Movies",
			editing: true,
			errorMessage: message,
			oldInput: {
				title: data1[0].title,
  			description: data1[0].description.trim(),
  			portrait_image: data1[0].image,
  			fileCode: data1[0].video,
  			video_length: data1[0].video_length,
  			id: data1[0].id
			}
		})
	}

	catch(error) {
		console.log("Edit Video error", error);
		return res.redirect("/v1/home");
	}
})

router.post("/v1/edit",
	[
		body('title')
			.trim()
			.notEmpty()
			.withMessage('Title is required.')
			.matches(/^[^<>]*$/)
			.withMessage('Invalid Title...'),
	  body("description")
	  	.trim()
	  	.notEmpty()
	  	.withMessage("Description is required")
	  	.matches(/^[^<>]*$/)
	  	.withMessage('Invalid Description...'),
	  body("portrait_image").trim().notEmpty().withMessage("Portrait Image is required").escape(),
	  body("fileCode").trim().notEmpty().withMessage("Video is required").escape(),
	  body("video_length")
	  	.trim()
	  	.notEmpty()
	  	.isNumeric() // Ensure it contains only numbers
    	.withMessage("Video length must be a number."),
    body("id")
    	.trim()
	  	.notEmpty()
	  	.isNumeric() // Ensure it contains only numbers
    	.withMessage("Id must be a number."),
	],
 	async (req, res, next) => {
		const { id } = req.body;

		try {
			// console.log(req.body);

			const { title, description, portrait_image, fileCode, video_length } = req.body;

			// console.log(title, description, portrait_image, fileCode);
			// console.log(typeof title, typeof description, typeof portrait_image, typeof fileCode);

			const cleanedTitle = title.trim();
			const cleanedDescription = description.trim();

			// console.log(req.body, cleanedTitle, cleanedDescription);

			// ${(oldInput.description && oldInput.description[index-1]) || ''}

			const error = validationResult(req);

	    if (!error.isEmpty()) {
				// console.log(error.array());

				let msg1 = error.array()[0].msg;

				return res.render("add2", {
					title: "Edit Movies",
					editing: true,
					errorMessage: msg1,
					oldInput: {
						title: cleanedTitle,
		  			description: cleanedDescription,
		  			portrait_image: portrait_image,
		  			fileCode: fileCode,
		  			video_length: video_length,
		  			id: id
					}
				})
			}

			else {
				let data = JSON.stringify({
				  "id": id,
				  "title": title,
				  "description": description,
				  "image": portrait_image,
				  "video": fileCode,
				  "video_length": video_length
				});

				let config = {
				  method: 'post',
				  maxBodyLength: Infinity,
				  url: baseUrl + 'update/video.php',
				  headers: { 
				    'Content-Type': 'application/json'
				  },
				  data : data
				};

				const response1 = await axios.request(config);
				const data1 = response1.data;

				console.log(data1);

				if (data1 && data1.isSuccess == true) {
					return res.redirect("/v1/home");
				}
				else {
					req.flash("error", "Failed to Update... Try Again...");
					return res.redirect(`/v1/edit/${id}`);
				}
			}
		}

		catch(error) {
			console.log("Edit post error", error);
			return res.redirect(`/v1/edit/${id}`);
		}
	}
)

router.get("/v1/sedit/:sid", isAuth, async (req, res, next) => {
	try {
		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}
		else {
			message = null;
		}

		const { sid } = req.params;
		const { vid } = req.query;

		// console.log(sid, vid);

		const postData = { "season": sid, "videoId": vid };
		const response1 = await axios.request(getData("get/episodesBySeason.php", "post", postData));
		const data1 = response1.data;

		// console.log(data1);

		const postData2 = { "vid": vid, "sid": sid };
		const response2 = await axios.request(getData("get/season.php", "post", postData2));
		const data2 = response2.data;

		// console.log(data2);

		const ep_title = data1.map(item => item.title.trim());
		const ep_description = data1.map(item => item.description.trim());
		const ep_image = data1.map(item => item.image);
		const ep_video = data1.map(item => item.video);
		const ep_videoLength = data1.map(item => item.video_length);

		return res.render("add3", {
			title: "Edit Series",
			editing: true,
			errorMessage: message,
			oldInput: {
				id: vid,
				sid: data2[0].season_id,
				season: data2[0].season_number,
				stitle: data2[0].title,
				sdescription: data2[0].description,
				title: ep_title,
  			description: ep_description,
  			portrait_image: ep_image,
  			fileCode: ep_video,
  			video_length: ep_videoLength,
			},
			count: data1.length
		})
	}

	catch(error) {
		console.log("Season Edit error", error);
		return res.redirect("/v1/home");
	}
})

router.post("/v1/sedit",
	[
		body('stitle')
			.trim()
			.notEmpty()
			.withMessage('Season Title is required.')
			.matches(/^[^<>]*$/)
			.withMessage('Invalid Season Title...'),
	  body("sdescription")
	  	.trim()
	  	.notEmpty()
	  	.withMessage("Season Description is required")
	  	.matches(/^[^<>]*$/)
	  	.withMessage('Invalid Season Description...'),
	  body("id")
      .trim()
      .notEmpty()
      .isNumeric()
      .withMessage("Id is required")
      .custom(value => {
        if (value == 0) {
          throw new Error("Id is required");
        }
        return true; // indicate success
      }),
	  body("season")
	  	.trim()
	  	.notEmpty()
	  	.isNumeric() // Ensure it contains only numbers
    	.withMessage("Season Number must be a number."),
    // Custom validation for empty arrays
    body('title')
      .custom(value => {
        // Check if the value is either a string or an array
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Title must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(title => title.trim() === '')) {
            throw new Error('Episode Title must not be empty.');
          }
        } else {
          throw new Error('Episode Title must be a string or an array.');
        }
        return true;
        
      // .custom(value => {
      //   if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
      //     throw new Error('Episode Title must not be empty.');
      //   }
      //   return true;
    }),

    body('description')
      .custom(value => {
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Description must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(img => img.trim() === '')) {
            throw new Error('Episode Description must not be empty.');
          }
        } else {
          throw new Error('Episode Description must be a string or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Description must not be empty.');
        // }
        // return true;
    }),

    body('portrait_image')
      .custom(value => {
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Image must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(img => img.trim() === '')) {
            throw new Error('Episode Image must not be empty.');
          }
        } else {
          throw new Error('Episode Image must be a string or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Image must not be empty.');
        // }
        // return true;
    }),

    body('fileCode')
      .custom(value => {
        if (typeof value === 'string') {
          if (value.trim() === '') {
            throw new Error('Episode Video must not be empty.');
          }
        } else if (Array.isArray(value)) {
          if (value.length === 0 || value.some(img => img.trim() === '')) {
            throw new Error('Episode Video must not be empty.');
          }
        } else {
          throw new Error('Episode Video must be a string or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Video must not be empty.');
        // }
        // return true;
   	}),

    body('video_length')
      .custom(value => {
        if (typeof value === 'number') {
          if (value <= 0) {
          	throw new Error('Episode Video length must not be empty and a positive number.');
          }
        } else if (Array.isArray(value)) {
          // if (value.length === 0 || value.some(img => img.trim() === '')) {
        	if (value.length === 0 || value.some(dur => typeof dur !== 'number' || dur <= 0)) {
            throw new Error('Episode Video length must not be empty.');
          }
        } else {
          throw new Error('Episode Video length must be a number or an array.');
        }
        return true;
        // if (!Array.isArray(value) || value.length === 0 || value.every(img => img.trim() === '')) {
        //   throw new Error('Episode Video length must not be empty.');
        // }
        // return true;
    	}),
	],
 	async (req, res, next) => {
		try {
			// console.log(req.body);

			const { id, sid, season, stitle, sdescription, title, description, portrait_image, fileCode, video_length } = req.body;

			// console.log(title, description, portrait_image, fileCode);
			// console.log(typeof title, typeof description, typeof logo, typeof portrait_image, typeof fileCode);

			const cleanedTitle = (typeof title == 'object') ? title.map(i => i.trim()) : [title.trim()];
			const cleanedDescription = (typeof description == 'object') ? description.map(i => i.trim()) : [description.trim()];
			const csDes = sdescription.trim();
			const pi = (typeof portrait_image == 'object') ? portrait_image : [portrait_image];
			const fc = (typeof fileCode == 'object') ? fileCode : [fileCode];
			const vl = (typeof video_length == 'object') ? video_length : [video_length];

			// console.log(cleanedTitle, cleanedDescription);

			// ${(oldInput.description && oldInput.description[index-1]) || ''}

			const error = validationResult(req);

	    if (!error.isEmpty()) {
				// console.log(error.array());

				let msg1 = error.array()[0].msg;

				return res.render("add3", {
					title: "Edit Series",
					editing: true,
					errorMessage: msg1,
					oldInput: {
						id: id,
						sid: sid,
						season: season,
						stitle: stitle,
						sdescription: csDes,
						title: cleanedTitle,
		  			description: cleanedDescription,
		  			portrait_image: pi,
		  			fileCode: fc,
		  			video_length: vl
					},
					count: cleanedTitle.length >= 1 ? cleanedTitle.length : 1
				})
			}

			else {
				let data = JSON.stringify({
				  "id": sid,
				  "video_id": id,
				  "season_number": season,
				  "title": stitle,
				  "description": csDes,
				  "ep_title": cleanedTitle,
				  "ep_description": cleanedDescription,
				  "ep_image": pi,
				  "ep_video": fc,
				  "ep_video_length": vl 				
				});

				let config = {
				  method: 'post',
				  maxBodyLength: Infinity,
				  url: baseUrl + 'update/season.php',
				  headers: { 
				    'Content-Type': 'application/json'
				  },
				  data : data
				};

				const response1 = await axios.request(config);
				const data1 = response1.data;

				// console.log(data1);

				if (data1 && data1.isSuccess) {
					return res.redirect("/v1/home");
				}

				else {
					return res.redirect(`/v1/sedit/<%= sid %>?id=<%= id %>`)
				}
			}
		}

		catch(error) {
			console.log("post edit season error", error);
			return res.redirect("/v1/home");
		}
	}
)

router.get("/v1/sdelete/:id", isAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const postData = { "id": id };
		const response1 = await axios.request(getData("delete/season.php", "post", postData));
		const data1 = response1.data;
    
    if (data1.isSuccess) {
      return res.redirect("/v1/home");
    }
    else {
      return req.flash("error", "Failed to delete. Try again...");
      return res.redirect(`/v1/sedit/${id}`);
    }
  }
  
  catch(error) {
    console.log("delete season error");
  }
})

router.get("/v1/plans", isAuth, async (req, res, next) => {
	try {
		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}

		else {
			message = null;
		}

		const products = await stripe.products.list({
			active: true,
		}); 

		// console.log(products.data);

		const prices = await stripe.prices.list({
		  active: true,
		}); 

		// console.log(prices.data);

		const plans = products.data.map((product, index) => {
			const matchingPrice = prices.data.find(price => price.id == product.default_price);
			// console.log(matchingPrice);
			return {
			  id: product.id,
			  name: product.name,
			  description: product.description,
			  amount: parseFloat(matchingPrice?.unit_amount),
			  price_id: matchingPrice?.id,
			  interval: matchingPrice?.recurring.interval,
			  interval_count: matchingPrice?.recurring.interval_count
			};
		}).reverse();

		// console.log(plans);

		return res.render("plans", {
			title: "Plans",
			errorMessage: message,
			data: plans
		})
	}

	catch(error) {
		console.log(error);
	}
})

router.get("/v1/add_plan", isAuth, async (req, res, next) => {
	try {
		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}
		else {
			message = null;
		}

		return res.render("createPlan", {
			title: "Add Plans",
			// edit: false,
			editing: false,
			errorMessage: message,
			oldInput: {
				name: '',
  			description: '',
  			unit_amount: '',
  			interval: '',
  			interval_count: '',
  			prod_id: '',
  			price_id: '',
			},
		})
	}

	catch(error) {
		console.log("Add plans error...");

		req.flash("error", "Failed to add plans...");
		return res.redirect("/v1/plans");
	}
})

router.post("/v1/add_plan",
	[
		body('productName')
			.trim()
			.notEmpty()
			.withMessage('Plan Name is required.')
			.matches(/^[^<>]*$/)
			.withMessage('Invalid Plan Name...'),
	  body("productDescription")
	  	.trim()
	  	.notEmpty()
	  	.withMessage("Plan Description is required")
	  	.matches(/^[^<>]*$/)
	  	.withMessage('Invalid Plan Description...'),
	  body("priceAmount")
	  	.trim()
	  	.notEmpty()
	  	.isNumeric() // Ensure it contains only numbers
    	.withMessage("Price must be a number."),
    body("interval")
    	.trim()
    	.notEmpty()
    	.withMessage("Plan Duration is required.")
    	.isIn(['day', 'week', 'month', 'year']) // Check if the value is in the allowed list
    	.withMessage('Invalid Plan Duration. Valid values are: day, week, month, year.'),
    body("interval_count")
	  	.trim()
	  	.notEmpty()
	  	.isNumeric() // Ensure it contains only numbers
    	.withMessage("Duration Count must be a number.")
	], 
	async (req, res, next) => {
		try {
			const {productName, productDescription, priceAmount, interval, interval_count} = req.body;

			const cleanedName = productName.trim();
			const cleanedDescription = productDescription.trim();

			// console.log(req.body);

			const error = validationResult(req);

	    if (!error.isEmpty()) {
				// console.log(error.array());

				let msg1 = error.array()[0].msg;

				return res.render("createPlan", {
					title: "Add Plans",
					editing: false,
					errorMessage: msg1,
					oldInput: {
						name: cleanedName,
		  			description: cleanedDescription,
		  			unit_amount: priceAmount,
		  			interval: interval,
  					interval_count: interval_count,
		  			prod_id: '',
  					price_id: '',
					},
				})
			}

			else {
				const product = await stripe.products.create({
		      name: cleanedName, // e.g. "Premium Plan"
		      description: cleanedDescription, // e.g. "Monthly subscription to premium features"
		      default_price_data: {
		      	currency: 'usd',
		      	unit_amount: parseFloat(priceAmount)*100,
		      	recurring: {
				    	interval: interval,
				    	interval_count: parseInt(interval_count),
				  	},
		      }
		    });

				// const price = await stripe.prices.create({
				//   currency: 'usd',
				//   unit_amount: parseInt(priceAmount),
				//   recurring: {
				//     interval: interval,
				//     interval_count: parseInt(interval_count),
				//   },
				//   product: product.id,
				// });

				return res.redirect("/v1/plans");
			}
		}

		catch (error) {
			console.log(error);

			req.flash("error", "Failed to add plans...");
			return res.redirect("/v1/plans");
		}
	}
)

router.get("/v1/edit_plans/:id", isAuth, async (req, res, next) => {
	try {
		let message = req.flash('error');
		// console.log(message);

		if (message.length > 0) {
			message = message;
		}
		else {
			message = null;
		}

		const { id } = req.params;

		// console.log(id);

		const product = await stripe.products.retrieve(id);

		const price = await stripe.prices.retrieve(product?.default_price);

		// console.log(product, price);

		return res.render("createPlan", {
			title: "Edit Plans",
			editing: true,
			errorMessage: message,
			oldInput: {
				name: product?.name.trim(),
  			description: product?.description.trim(),
  			unit_amount: parseFloat(price?.unit_amount_decimal)/100,
  			interval: price?.recurring.interval,
  			interval_count: price?.recurring.interval_count,
  			prod_id: product?.id,
  			price_id: price?.id,
			},
		})
	}

	catch(error) {
		console.log("Edit plans error...");

		req.flash("error", "Failed to edit plans...");
		return res.redirect("/v1/plans");
	}
})

router.post("/v1/edit_plans",
	[
		body('productName')
			.trim()
			.notEmpty()
			.withMessage('Plan Name is required.')
			.matches(/^[^<>]*$/)
			.withMessage('Invalid Plan Name...'),
	  body("productDescription")
	  	.trim()
	  	.notEmpty()
	  	.withMessage("Plan Description is required")
	  	.matches(/^[^<>]*$/)
	  	.withMessage('Invalid Plan Description...'),
	], 
	async (req, res, next) => {
		try {
			const {productName, productDescription, priceAmount, interval, interval_count, prod_id, price_id} = req.body;

			const cleanedName = productName.trim();
			const cleanedDescription = productDescription.trim();

			const error = validationResult(req);

	    if (!error.isEmpty()) {
				// console.log(error.array());

				let msg1 = error.array()[0].msg;

				return res.render("createPlan", {
					title: "Edit Plans",
					editing: true,
					errorMessage: msg1,
					oldInput: {
						name: cleanedName,
		  			description: cleanedDescription,
		  			unit_amount: priceAmount,
		  			interval: interval,
		  			interval_count: interval_count,
		  			prod_id: prod_id,
		  			price_id: price_id,
					},
				})
			}

			else {
				const product = await stripe.products.update(
				  prod_id,
				  {
				    description: cleanedDescription,
				    name: cleanedName
				  }
				);

				// console.log(product);

				return res.redirect("/v1/plans");
			}
		}

		catch(error) {
			console.log(error);

			req.flash("error", "Failed to Update try again...");
			return res.redirect("/v1/plans");
		}
	}
)

module.exports = router;