/**
 * What's new in each version, newest first. Shown from Settings → About.
 *
 * Add an entry in the same commit that bumps the version in package.json. Write
 * for the people using the app: what they can now do, or what works better now,
 * not the commit message.
 */

export interface ChangelogSection {
  /** Optional sub-heading, such as a month, for a long release. */
  heading?: string;
  items: string[];
}

export interface Release {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

export const CHANGELOG: Release[] = [
  {
    version: '2.2.0',
    date: '30 Oct 2026',
    sections: [{
      items: [
        'Ustadhs can set any status on a student\'s page, not only Test 1 Passed.',
        'Tap Version in Settings to see what is new. Tap a feature to read more about it.',
        'The Layout setting is removed from Settings.',
        'A class you have joined as a co-ustadh shows in your class list, and you can open it.',
        'Ustadh Codes are shown only to the class owner.',
        'Join messages name the class, so you can tell which account already owns or has joined it.',
        'Ustadhs enrolled as learners in another class are no longer labelled as its owner.',
      ],
    }],
  },
  {
    version: '2.1.2',
    date: '28 Oct 2026',
    sections: [{
      items: [
        'The version number is bigger and bold, and Settings shows it under About.',
        'Updates are optional again. Update installs the new version, and Later keeps the one you have.',
      ],
    }],
  },
  {
    version: '2.1.1',
    date: '28 Oct 2026',
    sections: [{
      items: [
        'Installs from before the update prompt were moved to this version automatically, once.',
      ],
    }],
  },
  {
    version: '2.1.0',
    date: '28 Oct 2026',
    sections: [{
      items: [
        'Ustadhs can permanently delete a student\'s account from the student\'s page.',
        'Students can mark pages as Test 1 Passed themselves.',
        'Pages scroll properly on phones, including Settings, Profile and Classes.',
        'The Hifz logo is the app icon.',
        'The app asks before installing an update: "This app needs an update." with Update and Later.',
        'The version number shows under "The Hifz App" on the welcome and splash screens, and in the sidebar.',
      ],
    }],
  },
  {
    version: '2.0.0',
    date: '22 May – 24 Sep 2026',
    sections: [
      {
        heading: 'May 2026',
        items: [
          'Sign in with Google, with a short tour on your first visit.',
          'Arabic text displays correctly, and Google profile pictures are shown.',
        ],
      },
      {
        heading: 'June 2026',
        items: [
          'Nazirah tracking, with a Nazirah log of the pages tracked that week.',
          'A History tab, with page ranges.',
          'The full Hifz module: Sabaq, Sabaq Para and Dawr, with cycles, lines and a date picker.',
          'Pages are shown as bigger tiles in a five-column grid.',
          'Your role (Student or Ustadh) is remembered on the device.',
          'You can sign in with a username and password as well as Google.',
        ],
      },
      {
        heading: 'July 2026',
        items: [
          'Joining a class with its code works again.',
        ],
      },
      {
        heading: 'August 2026',
        items: [
          'Ustadhs can create a class from their dashboard.',
          'A page that stays Ready to Memorize for ten days turns into Retest Needed.',
          'New students can record the memorisation they already have when they sign up.',
          'Nazirah pages scroll as one continuous, calendar-style grid.',
          'New status names and colours: Ready for Test 1, Test 1 Passed, Ready for Final Test, Ready to Memorize, Retest Needed and Memorized.',
          'The welcome screen asks what you want to do before it asks how to sign in.',
          'A Listen tab plays the Quran recitation of each page.',
        ],
      },
      {
        heading: 'September 2026',
        items: [
          'Class rosters show the test statuses only, with an on-track indicator.',
          'A practice counter for pages in practice, which keeps your progress if you close it.',
          'Ustadh Codes: co-Ustadhs can join a class and see its students.',
          'Switch between students with tabs at the top of a class.',
          'The Listen button sits next to Ready for Test 1 in the page editor, with speeds from 0.5x to 1.5x.',
          'Fixed the practice counter showing the count from a different page.',
        ],
      },
    ],
  },
];
