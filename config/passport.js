import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";

// GOOGLE
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.APP_URL}/auth/google/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      const user = {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails?.[0].value,
        avatar: profile.photos?.[0].value,
        provider: "google",
      };

      return done(null, user);
    }
  )
);

// FACEBOOK
// passport.use(
//   "facebook",
//   new FacebookStrategy(
//     {
//       clientID: process.env.FACEBOOK_CLIENT_ID,
//       clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
//       callbackURL: `${process.env.APP_URL}/auth/facebook/callback`,
//       profileFields: ["id", "displayName", "emails", "photos"],
//     },
//     (accessToken, refreshToken, profile, done) => {
//       const user = {
//         id: profile.id,
//         name: profile.displayName,
//         email: profile.emails?.[0]?.value,
//         avatar: profile.photos?.[0]?.value,
//         provider: "facebook",
//       };

//       return done(null, user);
//     }
//   )
// );