import mongoose from 'mongoose';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import bcrypt from 'bcryptjs';

// Load environment variables from .env.local manually (avoids needing dotenv as a dependency)
function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local may not exist; that's fine if MONGODB_URI is already set
  }
}

loadEnvFile(resolve(__dirname, '../.env.local'));

// Import models using relative paths (tsx may not resolve tsconfig paths)
import Centre from '../src/models/Centre';
import Qualification from '../src/models/Qualification';
import Unit from '../src/models/Unit';
import LearningOutcome from '../src/models/LearningOutcome';
import AssessmentCriteria from '../src/models/AssessmentCriteria';
import User from '../src/models/User';
import Enrolment from '../src/models/Enrolment';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  console.error('Make sure .env.local exists with MONGODB_URI defined.');
  process.exit(1);
}

const shouldReset = process.argv.includes('--reset');

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI as string);
  console.log('Connected to MongoDB.');

  if (shouldReset) {
    console.log('\n--- RESET MODE: Dropping all collections ---');
    const collections = await mongoose.connection.db!.listCollections().toArray();
    for (const col of collections) {
      await mongoose.connection.db!.dropCollection(col.name);
      console.log(`  Dropped collection: ${col.name}`);
    }
    console.log('All collections dropped.\n');
  }

  // ─── 1. Centre ───────────────────────────────────────────────────────────────
  console.log('Seeding Centre...');
  let centre = await Centre.findOne({ code: 'NTC001' });
  if (!centre) {
    centre = await Centre.create({
      name: 'NCFE Training Centre',
      code: 'NTC001',
      contactEmail: 'admin@ncfecentre.com',
      address: '123 Education Lane, London, UK',
      ncfeCentreNumber: '12345',
      status: 'active',
    });
    console.log(`  Created centre: ${centre.name} (${centre._id})`);
  } else {
    console.log(`  Centre already exists: ${centre.name} (${centre._id})`);
  }

  // ─── 2. Qualification ────────────────────────────────────────────────────────
  console.log('Seeding Qualification...');
  let qualification = await Qualification.findOne({ code: '601/1429/3' });
  if (!qualification) {
    qualification = await Qualification.create({
      title: 'NCFE Level 3 Certificate in Assessing Vocational Achievement',
      level: 3,
      code: '601/1429/3',
      awardingBody: 'NCFE/CACHE',
      description:
        'This qualification is for those who wish to achieve a nationally recognised assessor qualification.',
      status: 'active',
    });
    console.log(`  Created qualification: ${qualification.title} (${qualification._id})`);
  } else {
    console.log(`  Qualification already exists: ${qualification.title} (${qualification._id})`);
  }

  // ─── 3. Units, Learning Outcomes & Assessment Criteria ────────────────────────
  console.log('Seeding Units, Learning Outcomes & Assessment Criteria...');

  const unitsData = [
    {
      unitReference: 'Unit 301',
      title: 'Understanding the principles and practices of assessment',
      learningOutcomes: [
        {
          loNumber: 'LO1',
          description: 'Understand the principles and requirements of assessment',
          assessmentCriteria: [
            { acNumber: '1.1', description: 'Explain the functions of assessment in learning and development' },
            { acNumber: '1.2', description: 'Define the key concepts and principles of assessment' },
            { acNumber: '1.3', description: 'Explain the responsibilities of the assessor' },
            { acNumber: '1.4', description: 'Identify the regulations, codes of practice and policies that influence assessment' },
          ],
        },
        {
          loNumber: 'LO2',
          description: 'Understand different types of assessment method',
          assessmentCriteria: [
            { acNumber: '2.1', description: 'Compare the strengths and limitations of a range of assessment methods with reference to the needs of individual learners' },
          ],
        },
        {
          loNumber: 'LO3',
          description: 'Understand how to plan assessment',
          assessmentCriteria: [
            { acNumber: '3.1', description: 'Summarise key factors to consider when planning assessment' },
            { acNumber: '3.2', description: 'Evaluate the benefits of using a holistic approach to assessment' },
            { acNumber: '3.3', description: 'Explain how to plan a holistic approach to assessment' },
            { acNumber: '3.4', description: 'Summarise the types of risks that may be involved in assessment in own area of responsibility' },
          ],
        },
        {
          loNumber: 'LO4',
          description: 'Understand how to involve learners and others in assessment',
          assessmentCriteria: [
            { acNumber: '4.1', description: 'Explain the importance of involving the learner and others in the assessment process' },
            { acNumber: '4.2', description: 'Summarise types of information that should be made available to learners and others involved in the assessment process' },
            { acNumber: '4.3', description: 'Explain how peer and self-assessment can be used effectively to promote learner involvement and personal responsibility in the assessment of learning' },
            { acNumber: '4.4', description: 'Explain how assessment arrangements can be adapted to meet the needs of individual learners' },
          ],
        },
        {
          loNumber: 'LO5',
          description: 'Understand how to make assessment decisions',
          assessmentCriteria: [
            { acNumber: '5.1', description: 'Explain how to judge whether evidence is sufficient, authentic and current' },
            { acNumber: '5.2', description: 'Explain how to ensure that assessment decisions are made against specified criteria, are valid, reliable and fair' },
          ],
        },
        {
          loNumber: 'LO6',
          description: 'Understand quality assurance of the assessment process',
          assessmentCriteria: [
            { acNumber: '6.1', description: 'Evaluate the importance of quality assurance in the assessment process' },
            { acNumber: '6.2', description: 'Summarise quality assurance and standardisation procedures in own area of practice' },
            { acNumber: '6.3', description: 'Summarise the procedures to follow when there are disputes concerning assessment in own area of practice' },
          ],
        },
        {
          loNumber: 'LO7',
          description: 'Understand how to manage information relating to assessment',
          assessmentCriteria: [
            { acNumber: '7.1', description: 'Explain the importance of following procedures for the management of information relating to assessment' },
            { acNumber: '7.2', description: 'Explain how feedback and questioning contribute to the assessment process' },
          ],
        },
        {
          loNumber: 'LO8',
          description: 'Understand the legal and good practice requirements in relation to assessment',
          assessmentCriteria: [
            { acNumber: '8.1', description: 'Explain legal issues, policies and procedures relevant to assessment, including those for confidentiality, health, safety and welfare' },
            { acNumber: '8.2', description: 'Explain the contribution that technology can make to the assessment process' },
            { acNumber: '8.3', description: 'Evaluate requirements for equality and diversity and, where appropriate, bilingualism in relation to assessment' },
            { acNumber: '8.4', description: 'Explain the value of reflective practice and continuing professional development in the assessment process' },
          ],
        },
      ],
    },
    {
      unitReference: 'Unit 302',
      title: 'Assess occupational competence in the work environment',
      learningOutcomes: [
        {
          loNumber: 'LO1',
          description: 'Be able to plan the assessment of occupational competence',
          assessmentCriteria: [
            { acNumber: '1.1', description: 'Plan assessment of occupational competence based on the following methods: observation of performance in the work environment, examining products of work, questioning the learner, discussing with the learner, use of others (e.g. witness testimony), looking at learner statements, recognising prior learning' },
            { acNumber: '1.2', description: 'Communicate the purpose, requirements and processes of assessment of occupational competence to the learner' },
            { acNumber: '1.3', description: 'Plan the assessment of occupational competence to address learner needs and current achievements' },
            { acNumber: '1.4', description: 'Identify opportunities for holistic assessment of occupational competence' },
          ],
        },
        {
          loNumber: 'LO2',
          description: 'Be able to make assessment decisions about occupational competence',
          assessmentCriteria: [
            { acNumber: '2.1', description: 'Use valid, fair and reliable assessment methods including observation to make assessment decisions of occupational competence' },
            { acNumber: '2.2', description: 'Make safe, fair and reliable assessment decisions about occupational competence against specified criteria' },
            { acNumber: '2.3', description: 'Follow standardisation procedures' },
            { acNumber: '2.4', description: 'Apply policies, procedures and legislation relating to assessment of occupational competence including any requirements for reasonable adjustments' },
          ],
        },
        {
          loNumber: 'LO3',
          description: 'Be able to provide required information following the assessment of occupational competence',
          assessmentCriteria: [
            { acNumber: '3.1', description: 'Follow agreed procedures to record, store and report assessment decisions about occupational competence' },
            { acNumber: '3.2', description: 'Communicate assessment decisions to the learner, clearly, constructively and in an appropriate way' },
          ],
        },
      ],
    },
    {
      unitReference: 'Unit 303',
      title: 'Assess vocational skills, knowledge and understanding',
      learningOutcomes: [
        {
          loNumber: 'LO1',
          description: 'Be able to prepare assessments of vocational skills, knowledge and understanding',
          assessmentCriteria: [
            { acNumber: '1.1', description: 'Select methods to assess vocational skills, knowledge and understanding which address learner needs and meet assessment requirements including skills, knowledge, understanding, and assignments' },
            { acNumber: '1.2', description: 'Prepare resources and conditions for the assessment of vocational skills, knowledge and understanding' },
            { acNumber: '1.3', description: 'Communicate the purpose, requirements and processes of assessment of vocational skills, knowledge and understanding to learners' },
          ],
        },
        {
          loNumber: 'LO2',
          description: 'Be able to carry out assessments of vocational skills, knowledge and understanding',
          assessmentCriteria: [
            { acNumber: '2.1', description: 'Manage assessments of vocational skills, knowledge and understanding to meet assessment requirements' },
            { acNumber: '2.2', description: 'Provide support to learners within agreed limitations' },
            { acNumber: '2.3', description: 'Analyse evidence of learner achievement' },
            { acNumber: '2.4', description: 'Make assessment decisions relating to vocational skills, knowledge and understanding against specified criteria' },
            { acNumber: '2.5', description: 'Follow standardisation procedures' },
            { acNumber: '2.6', description: 'Apply policies, procedures and legislation relating to the assessment of vocational skills, knowledge and understanding' },
          ],
        },
        {
          loNumber: 'LO3',
          description: 'Be able to provide required information following the assessment of vocational skills, knowledge and understanding',
          assessmentCriteria: [
            { acNumber: '3.1', description: 'Record assessment decisions for the assessment of vocational skills, knowledge and understanding' },
            { acNumber: '3.2', description: 'Communicate assessment decisions to the learner clearly, constructively and in an appropriate way' },
            { acNumber: '3.3', description: 'Follow agreed procedures to record, store and report assessment decisions' },
          ],
        },
      ],
    },
  ];

  for (const unitData of unitsData) {
    let unit = await Unit.findOne({
      unitReference: unitData.unitReference,
      qualificationId: qualification._id,
    });

    if (!unit) {
      unit = await Unit.create({
        unitReference: unitData.unitReference,
        title: unitData.title,
        description: unitData.title,
        qualificationId: qualification._id,
      });
      console.log(`  Created unit: ${unit.unitReference} - ${unit.title}`);
    } else {
      console.log(`  Unit already exists: ${unit.unitReference} - ${unit.title}`);
    }

    for (const loData of unitData.learningOutcomes) {
      let lo = await LearningOutcome.findOne({
        unitId: unit._id,
        loNumber: loData.loNumber,
      });

      if (!lo) {
        lo = await LearningOutcome.create({
          unitId: unit._id,
          loNumber: loData.loNumber,
          description: loData.description,
        });
        console.log(`    Created LO: ${lo.loNumber} - ${lo.description}`);
      } else {
        console.log(`    LO already exists: ${lo.loNumber} - ${lo.description}`);
      }

      for (const acData of loData.assessmentCriteria) {
        const existingAC = await AssessmentCriteria.findOne({
          learningOutcomeId: lo._id,
          acNumber: acData.acNumber,
        });

        if (!existingAC) {
          await AssessmentCriteria.create({
            learningOutcomeId: lo._id,
            unitId: unit._id,
            qualificationId: qualification._id,
            acNumber: acData.acNumber,
            description: acData.description,
          });
          console.log(`      Created AC: ${acData.acNumber} - ${acData.description.substring(0, 60)}...`);
        } else {
          console.log(`      AC already exists: ${acData.acNumber}`);
        }
      }
    }
  }

  // ─── 4. Users ─────────────────────────────────────────────────────────────────
  console.log('\nSeeding Users...');
  const password = 'Password123!';
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const usersData = [
    { name: 'Jane Smith', email: 'student@test.com', role: 'student' },
    { name: 'John Davies', email: 'assessor@test.com', role: 'assessor' },
    { name: 'Sarah Williams', email: 'iqa@test.com', role: 'iqa' },
  ];

  const createdUsers: Record<string, mongoose.Document> = {};

  for (const userData of usersData) {
    let user = await User.findOne({ email: userData.email });

    if (!user) {
      // Use Model.collection.insertOne to bypass the pre-save hook
      // since we already hashed the password ourselves
      const result = await User.collection.insertOne({
        name: userData.name,
        email: userData.email,
        passwordHash: hashedPassword,
        role: userData.role,
        centreId: centre._id,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user = await User.findById(result.insertedId);
      console.log(`  Created user: ${userData.name} (${userData.email}) - role: ${userData.role}`);
    } else {
      console.log(`  User already exists: ${userData.name} (${userData.email})`);
    }

    createdUsers[userData.role] = user!;
  }

  // ─── 5. Enrolment ────────────────────────────────────────────────────────────
  console.log('\nSeeding Enrolment...');
  const studentUser = createdUsers['student'];
  const assessorUser = createdUsers['assessor'];

  let enrolment = await Enrolment.findOne({
    userId: studentUser._id,
    qualificationId: qualification._id,
  });

  if (!enrolment) {
    enrolment = await Enrolment.create({
      userId: studentUser._id,
      qualificationId: qualification._id,
      assessorId: assessorUser._id,
      status: 'in_progress',
      cohortId: '2026-Q1',
      enrolledAt: new Date(),
    });
    console.log(`  Created enrolment: Student ${(studentUser as any).name} -> ${qualification.title}`);
    console.log(`    Assessor: ${(assessorUser as any).name}, Cohort: 2026-Q1, Status: in_progress`);
  } else {
    console.log(`  Enrolment already exists for student ${(studentUser as any).name}`);
  }

  // ─── Done ─────────────────────────────────────────────────────────────────────
  console.log('\n--- Seed complete! ---');
  console.log('Summary:');
  console.log(`  Centre: ${centre.name}`);
  console.log(`  Qualification: ${qualification.title}`);
  console.log(`  Units: ${unitsData.length}`);
  console.log(`  Users: ${usersData.length}`);
  console.log(`  Enrolment: 1`);

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB. Done.');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed script failed:', error);
  mongoose.disconnect();
  process.exit(1);
});
