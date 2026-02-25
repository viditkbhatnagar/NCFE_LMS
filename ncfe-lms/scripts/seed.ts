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
import Assessment from '../src/models/Assessment';
import SignOff from '../src/models/SignOff';
import WorkHoursLog from '../src/models/WorkHoursLog';
import AssessmentCriteriaMap from '../src/models/AssessmentCriteriaMap';
import Evidence from '../src/models/Evidence';
import CourseDocument from '../src/models/CourseDocument';
import PersonalDocument from '../src/models/PersonalDocument';
import LearningMaterial from '../src/models/LearningMaterial';

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
      slug: 'ncfe-level-3-certificate-in-assessing-vocational-achievement',
      level: 3,
      code: '601/1429/3',
      awardingBody: 'NCFE/CACHE',
      description:
        'This qualification is for those who wish to achieve a nationally recognised assessor qualification.',
      status: 'active',
    });
    console.log(`  Created qualification: ${qualification.title} (${qualification._id})`);
  } else {
    // Ensure slug exists on existing qualification
    if (!qualification.slug) {
      qualification.slug = 'ncfe-level-3-certificate-in-assessing-vocational-achievement';
      await qualification.save();
      console.log(`  Updated qualification with slug: ${qualification.slug}`);
    }
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
  const saltRounds = 12;

  // Hash different passwords for different user groups
  const testPassword = await bcrypt.hash('Password123!', saltRounds);
  const adminPassword = await bcrypt.hash('passwordadmin', saltRounds);
  const realAssessorPassword = await bcrypt.hash('password123', saltRounds);
  const realStudentPassword = await bcrypt.hash('password', saltRounds);

  const usersData = [
    // Test users
    { name: 'Jane Smith', email: 'student@test.com', role: 'student', pw: testPassword },
    { name: 'Emma Thompson', email: 'student2@test.com', role: 'student', pw: testPassword },
    { name: 'Sarah Williams', email: 'iqa@test.com', role: 'iqa', pw: testPassword },
    // Real users
    { name: 'Jyothi', email: 'jyothi@learnerseducation.com', role: 'assessor', pw: realAssessorPassword },
    { name: 'Vidit Bhatnagar', email: 'bhatnagar007vidit@gmail.com', role: 'student', pw: realStudentPassword },
    { name: 'Intern', email: 'intern@learnerseducation.com', role: 'student', pw: realStudentPassword },
    // Admin
    { name: 'Admin User', email: 'admin@learnerseducation.com', role: 'admin', pw: adminPassword },
  ];

  const createdUsers: Record<string, mongoose.Document> = {};

  for (const userData of usersData) {
    let user = await User.findOne({ email: userData.email });

    if (!user) {
      const result = await User.collection.insertOne({
        name: userData.name,
        email: userData.email,
        passwordHash: userData.pw,
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

    // Use email as key for easy lookup
    createdUsers[userData.email] = user!;
  }

  // ─── 5. Enrolments ──────────────────────────────────────────────────────────
  console.log('\nSeeding Enrolments...');
  const studentUser = createdUsers['student@test.com'];
  const student2User = createdUsers['student2@test.com'];
  const assessorUser = createdUsers['jyothi@learnerseducation.com'];
  const realStudent1 = createdUsers['bhatnagar007vidit@gmail.com'];
  const realStudent2 = createdUsers['intern@learnerseducation.com'];

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

  let enrolment2 = await Enrolment.findOne({
    userId: student2User._id,
    qualificationId: qualification._id,
  });

  if (!enrolment2) {
    enrolment2 = await Enrolment.create({
      userId: student2User._id,
      qualificationId: qualification._id,
      assessorId: assessorUser._id,
      status: 'in_progress',
      cohortId: '2026-Q1',
      enrolledAt: new Date(),
    });
    console.log(`  Created enrolment: Student ${(student2User as any).name} -> ${qualification.title}`);
    console.log(`    Assessor: ${(assessorUser as any).name}, Cohort: 2026-Q1, Status: in_progress`);
  } else {
    console.log(`  Enrolment already exists for student ${(student2User as any).name}`);
  }

  // Real user enrolments (Vidit & Intern -> Jyothi as assessor)
  let enrolmentVidit = await Enrolment.findOne({
    userId: realStudent1._id,
    qualificationId: qualification._id,
  });

  if (!enrolmentVidit) {
    enrolmentVidit = await Enrolment.create({
      userId: realStudent1._id,
      qualificationId: qualification._id,
      assessorId: assessorUser._id,
      status: 'in_progress',
      cohortId: '2026-Q1',
      enrolledAt: new Date(),
    });
    console.log(`  Created enrolment: ${(realStudent1 as any).name} -> ${qualification.title}`);
    console.log(`    Assessor: ${(assessorUser as any).name}, Cohort: 2026-Q1`);
  } else {
    console.log(`  Enrolment already exists for ${(realStudent1 as any).name}`);
  }

  let enrolmentIntern = await Enrolment.findOne({
    userId: realStudent2._id,
    qualificationId: qualification._id,
  });

  if (!enrolmentIntern) {
    enrolmentIntern = await Enrolment.create({
      userId: realStudent2._id,
      qualificationId: qualification._id,
      assessorId: assessorUser._id,
      status: 'in_progress',
      cohortId: '2026-Q1',
      enrolledAt: new Date(),
    });
    console.log(`  Created enrolment: ${(realStudent2 as any).name} -> ${qualification.title}`);
    console.log(`    Assessor: ${(assessorUser as any).name}, Cohort: 2026-Q1`);
  } else {
    console.log(`  Enrolment already exists for ${(realStudent2 as any).name}`);
  }

  // ─── 6. BRITEthink Assessments ──────────────────────────────────────────────
  console.log('\nSeeding BRITEthink Assessments...');

  const existingAssessment = await Assessment.findOne({ enrollmentId: enrolment._id });
  if (!existingAssessment) {
    const assessmentsData = [
      {
        title: 'Workplace Observation - Unit 302',
        date: new Date('2026-02-15'),
        assessmentKind: 'observation' as const,
        planIntent: 'Observe the learner conducting an assessment in the workplace.',
        planImplementation: '',
        status: 'published' as const,
      },
      {
        title: 'Professional Discussion on Assessment Planning',
        date: new Date('2026-02-10'),
        assessmentKind: 'professional_discussion' as const,
        planIntent: 'Discuss the learner\'s approach to planning assessments.',
        planImplementation: 'Cover Units 301 and 302 planning criteria.',
        status: 'published' as const,
      },
      {
        title: 'Written Assessment - QA Principles',
        date: new Date('2026-02-17'),
        assessmentKind: 'written_assessment' as const,
        planIntent: '',
        planImplementation: '',
        status: 'draft' as const,
      },
    ];

    for (const aData of assessmentsData) {
      const assessment = await Assessment.create({
        ...aData,
        learnerId: studentUser._id,
        assessorId: assessorUser._id,
        enrollmentId: enrolment._id,
        qualificationId: qualification._id,
      });

      // Create 4 sign-off records for each assessment
      const signOffRoles = ['assessor', 'iqa', 'eqa', 'learner'] as const;
      for (const role of signOffRoles) {
        await SignOff.create({
          assessmentId: assessment._id,
          role,
          status: 'pending',
        });
      }

      console.log(`  Created assessment: ${aData.title} (${aData.status})`);
    }
  } else {
    console.log('  Assessments already exist, skipping...');
  }

  // ─── 6b. Assessments for Student 2 (Emma Thompson) ─────────────────────────
  console.log('\nSeeding Assessments for Student 2...');
  const existingAssessment2 = await Assessment.findOne({ enrollmentId: enrolment2._id });
  if (!existingAssessment2) {
    const assessments2Data = [
      {
        title: 'Observation - Learner Assessment Delivery',
        date: new Date('2026-02-12'),
        assessmentKind: 'observation' as const,
        planIntent: 'Observe Emma delivering an assessment in a real workplace setting, focusing on communication and assessment methods.',
        planImplementation: 'Observation at placement site covering LO1 and LO2 of Unit 302.',
        status: 'published' as const,
      },
      {
        title: 'Witness Testimony - Peer Teaching Session',
        date: new Date('2026-02-16'),
        assessmentKind: 'witness_testimony' as const,
        planIntent: 'Gather witness statement from workplace mentor on Emma\'s peer teaching.',
        planImplementation: '',
        status: 'published' as const,
      },
      {
        title: 'Work Product Review - Portfolio Build',
        date: new Date('2026-02-18'),
        assessmentKind: 'work_product' as const,
        planIntent: '',
        planImplementation: '',
        status: 'draft' as const,
      },
      {
        title: 'Professional Discussion - QA and Standardisation',
        date: new Date('2026-02-13'),
        assessmentKind: 'professional_discussion' as const,
        planIntent: 'Discuss Emma\'s understanding of quality assurance procedures and standardisation.',
        planImplementation: 'Focus on Unit 301 LO6 and LO7 criteria.',
        status: 'published' as const,
      },
    ];

    for (const aData of assessments2Data) {
      const assessment = await Assessment.create({
        ...aData,
        learnerId: student2User._id,
        assessorId: assessorUser._id,
        enrollmentId: enrolment2._id,
        qualificationId: qualification._id,
      });

      const signOffRoles = ['assessor', 'iqa', 'eqa', 'learner'] as const;
      for (const role of signOffRoles) {
        await SignOff.create({
          assessmentId: assessment._id,
          role,
          status: 'pending',
        });
      }

      console.log(`  Created assessment: ${aData.title} (${aData.status})`);
    }
  } else {
    console.log('  Assessments for Student 2 already exist, skipping...');
  }

  // ─── 7. Work Hours Log Entries ──────────────────────────────────────────────
  console.log('\nSeeding Work Hours Log...');
  const existingWorkHours = await WorkHoursLog.findOne({ enrollmentId: enrolment._id });
  if (!existingWorkHours) {
    const workHoursData = [
      { date: new Date('2026-02-14'), hours: 6, minutes: 30, notes: 'Assessment planning and preparation' },
      { date: new Date('2026-02-15'), hours: 7, minutes: 0, notes: 'Workplace observation and feedback' },
      { date: new Date('2026-02-17'), hours: 4, minutes: 15, notes: 'Professional discussion session' },
    ];

    for (const whData of workHoursData) {
      await WorkHoursLog.create({
        ...whData,
        enrollmentId: enrolment._id,
        learnerId: studentUser._id,
        recordedBy: assessorUser._id,
      });
      console.log(`  Created work hours (Jane): ${whData.date.toISOString().split('T')[0]} - ${whData.hours}h ${whData.minutes}m`);
    }
  } else {
    console.log('  Work hours for Jane already exist, skipping...');
  }

  // Work hours for Student 2
  const existingWorkHours2 = await WorkHoursLog.findOne({ enrollmentId: enrolment2._id });
  if (!existingWorkHours2) {
    const workHours2Data = [
      { date: new Date('2026-02-10'), hours: 5, minutes: 0, notes: 'Initial assessment planning with assessor' },
      { date: new Date('2026-02-12'), hours: 8, minutes: 0, notes: 'Workplace observation day' },
      { date: new Date('2026-02-13'), hours: 3, minutes: 45, notes: 'Professional discussion and reflection' },
      { date: new Date('2026-02-16'), hours: 6, minutes: 15, notes: 'Peer teaching and witness testimony' },
      { date: new Date('2026-02-17'), hours: 4, minutes: 30, notes: 'Portfolio evidence compilation' },
    ];

    for (const whData of workHours2Data) {
      await WorkHoursLog.create({
        ...whData,
        enrollmentId: enrolment2._id,
        learnerId: student2User._id,
        recordedBy: assessorUser._id,
      });
      console.log(`  Created work hours (Emma): ${whData.date.toISOString().split('T')[0]} - ${whData.hours}h ${whData.minutes}m`);
    }
  } else {
    console.log('  Work hours for Emma already exist, skipping...');
  }

  // ─── 8. Assessment Criteria Mappings ────────────────────────────────────────
  console.log('\nSeeding Assessment Criteria Mappings...');
  const existingMaps = await AssessmentCriteriaMap.findOne({});
  if (!existingMaps) {
    // Get all assessments and criteria
    const allAssessments = await Assessment.find({ qualificationId: qualification._id }).lean();
    const allCriteria = await AssessmentCriteria.find({ qualificationId: qualification._id }).lean();

    // Map published assessments to criteria (distribute criteria across assessments)
    const publishedAssessments = allAssessments.filter((a) => a.status === 'published');
    let criteriaIndex = 0;
    for (const assessment of publishedAssessments) {
      // Map 3-5 criteria per published assessment
      const numCriteria = Math.min(3 + Math.floor(Math.random() * 3), allCriteria.length - criteriaIndex);
      for (let i = 0; i < numCriteria && criteriaIndex < allCriteria.length; i++) {
        await AssessmentCriteriaMap.create({
          assessmentId: assessment._id,
          criteriaId: allCriteria[criteriaIndex]._id,
        });
        criteriaIndex++;
      }
      console.log(`  Mapped ${numCriteria} criteria to: ${assessment.title}`);
    }
    // Wrap around for remaining published assessments
    console.log(`  Total criteria mapped: ${criteriaIndex}`);
  } else {
    console.log('  Assessment criteria mappings already exist, skipping...');
  }

  // ─── 9. Evidence ──────────────────────────────────────────────────────────────
  console.log('\nSeeding Evidence...');
  const existingEvidence = await Evidence.findOne({});
  if (!existingEvidence) {
    // Get units for evidence
    const units = await Unit.find({ qualificationId: qualification._id }).lean();

    const evidenceData = [
      {
        enrolmentId: enrolment._id,
        unitId: units[0]._id,
        fileUrl: '/uploads/evidence/observation-notes-unit302.pdf',
        fileName: 'Observation Notes - Unit 302.pdf',
        fileType: 'application/pdf',
        fileSize: 245760,
        label: 'Workplace Observation Notes',
        description: 'Detailed observation notes from workplace assessment on 15 Feb 2026',
        uploadedAt: new Date('2026-02-15'),
        status: 'assessed' as const,
      },
      {
        enrolmentId: enrolment._id,
        unitId: units[0]._id,
        fileUrl: '/uploads/evidence/reflective-journal-jan.docx',
        fileName: 'Reflective Journal - January 2026.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 189440,
        label: 'Reflective Journal',
        description: 'Monthly reflective journal covering assessment planning activities',
        uploadedAt: new Date('2026-02-01'),
        status: 'submitted' as const,
      },
      {
        enrolmentId: enrolment._id,
        unitId: units[1]._id,
        fileUrl: '/uploads/evidence/assessment-plan-template.pdf',
        fileName: 'Assessment Plan - LO1.pdf',
        fileType: 'application/pdf',
        fileSize: 156672,
        label: 'Assessment Plan Document',
        description: 'Completed assessment plan template for Unit 302 LO1',
        uploadedAt: new Date('2026-02-12'),
        status: 'assessed' as const,
      },
      {
        enrolmentId: enrolment2._id,
        unitId: units[0]._id,
        fileUrl: '/uploads/evidence/witness-statement-emma.pdf',
        fileName: 'Witness Statement - Peer Teaching.pdf',
        fileType: 'application/pdf',
        fileSize: 102400,
        label: 'Witness Statement',
        description: 'Witness testimony from workplace mentor regarding peer teaching session',
        uploadedAt: new Date('2026-02-16'),
        status: 'submitted' as const,
      },
      {
        enrolmentId: enrolment2._id,
        unitId: units[1]._id,
        fileUrl: '/uploads/evidence/portfolio-photos.zip',
        fileName: 'Workplace Photos - Assessment Day.zip',
        fileType: 'application/zip',
        fileSize: 5242880,
        label: 'Workplace Evidence Photos',
        description: 'Photos from workplace observation day documenting assessment delivery',
        uploadedAt: new Date('2026-02-13'),
        status: 'draft' as const,
      },
      {
        enrolmentId: enrolment2._id,
        unitId: units[2]._id,
        fileUrl: '/uploads/evidence/qa-discussion-recording.mp4',
        fileName: 'QA Discussion Recording.mp4',
        fileType: 'video/mp4',
        fileSize: 15728640,
        label: 'Professional Discussion Recording',
        description: 'Recording of professional discussion on QA and standardisation procedures',
        uploadedAt: new Date('2026-02-14'),
        status: 'assessed' as const,
      },
    ];

    for (const ev of evidenceData) {
      await Evidence.create(ev);
      console.log(`  Created evidence: ${ev.label} (${ev.status})`);
    }
  } else {
    console.log('  Evidence already exists, skipping...');
  }

  // ─── 10. Course Documents ─────────────────────────────────────────────────────
  console.log('\nSeeding Course Documents...');
  const existingCourseDocs = await CourseDocument.findOne({});
  if (!existingCourseDocs) {
    // Create a folder first
    const folder = await CourseDocument.create({
      qualificationId: qualification._id,
      fileName: 'Assessment Templates',
      isFolder: true,
      uploadedBy: assessorUser._id,
    });
    console.log(`  Created folder: ${folder.fileName}`);

    const courseDocsData = [
      {
        fileName: 'Course Handbook 2026.pdf',
        fileUrl: '/uploads/course-docs/course-handbook-2026.pdf',
        fileType: 'application/pdf',
        fileSize: 1048576,
        folderId: null,
      },
      {
        fileName: 'Assessment Strategy Guide.pdf',
        fileUrl: '/uploads/course-docs/assessment-strategy-guide.pdf',
        fileType: 'application/pdf',
        fileSize: 524288,
        folderId: null,
      },
      {
        fileName: 'Observation Record Template.docx',
        fileUrl: '/uploads/course-docs/observation-record-template.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 81920,
        folderId: folder._id,
      },
      {
        fileName: 'Professional Discussion Template.docx',
        fileUrl: '/uploads/course-docs/pd-template.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 73728,
        folderId: folder._id,
      },
      {
        fileName: 'Internal Quality Assurance Policy.pdf',
        fileUrl: '/uploads/course-docs/iqa-policy.pdf',
        fileType: 'application/pdf',
        fileSize: 327680,
        folderId: null,
      },
    ];

    for (const doc of courseDocsData) {
      await CourseDocument.create({
        ...doc,
        qualificationId: qualification._id,
        uploadedBy: assessorUser._id,
      });
      console.log(`  Created course doc: ${doc.fileName}`);
    }
  } else {
    console.log('  Course documents already exist, skipping...');
  }

  // ─── 11. Personal Documents ───────────────────────────────────────────────────
  console.log('\nSeeding Personal Documents...');
  const existingPersonalDocs = await PersonalDocument.findOne({});
  if (!existingPersonalDocs) {
    const personalDocsData = [
      {
        userId: studentUser._id,
        fileName: 'DBS Certificate.pdf',
        fileUrl: '/uploads/personal/jane-dbs-cert.pdf',
        fileType: 'application/pdf',
        fileSize: 204800,
        uploadedBy: studentUser._id,
      },
      {
        userId: studentUser._id,
        fileName: 'Teaching Qualification Certificate.pdf',
        fileUrl: '/uploads/personal/jane-teaching-cert.pdf',
        fileType: 'application/pdf',
        fileSize: 163840,
        uploadedBy: studentUser._id,
      },
      {
        userId: student2User._id,
        fileName: 'CV - Emma Thompson 2026.docx',
        fileUrl: '/uploads/personal/emma-cv-2026.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 122880,
        uploadedBy: student2User._id,
      },
      {
        userId: student2User._id,
        fileName: 'First Aid Certificate.pdf',
        fileUrl: '/uploads/personal/emma-first-aid.pdf',
        fileType: 'application/pdf',
        fileSize: 143360,
        uploadedBy: student2User._id,
      },
    ];

    for (const doc of personalDocsData) {
      await PersonalDocument.create(doc);
      console.log(`  Created personal doc: ${doc.fileName} (for ${doc.userId === studentUser._id ? 'Jane' : 'Emma'})`);
    }
  } else {
    console.log('  Personal documents already exist, skipping...');
  }

  // ─── 12. Learning Materials ───────────────────────────────────────────────────
  console.log('\nSeeding Learning Materials...');
  const existingMaterials = await LearningMaterial.findOne({ qualificationId: qualification._id });
  if (!existingMaterials) {
    const materialsData = [
      {
        title: 'Assessment Methods Handbook',
        description: 'Comprehensive guide to different assessment methods',
        fileName: 'assessment-methods-handbook.pdf',
        fileUrl: '/uploads/materials/assessment-methods-handbook.pdf',
        fileType: 'pdf' as const,
        fileSize: 2097152,
        category: 'manual' as const,
      },
      {
        title: 'Unit 301 - Assessment Principles Slides',
        description: 'Presentation slides covering assessment principles and practices',
        fileName: 'unit-301-slides.pptx',
        fileUrl: '/uploads/materials/unit-301-slides.pptx',
        fileType: 'pptx' as const,
        fileSize: 4194304,
        category: 'slides' as const,
      },
      {
        title: 'Workplace Observation Tutorial',
        description: 'Video tutorial on conducting workplace observations',
        fileName: 'observation-tutorial.mp4',
        fileUrl: '/uploads/materials/observation-tutorial.mp4',
        fileType: 'video' as const,
        fileSize: 52428800,
        category: 'video' as const,
      },
      {
        title: 'Assessment Planning Guidance',
        description: 'Step-by-step guidance for planning assessments holistically',
        fileName: 'assessment-planning-guidance.pdf',
        fileUrl: '/uploads/materials/assessment-planning-guidance.pdf',
        fileType: 'pdf' as const,
        fileSize: 819200,
        category: 'guidance' as const,
      },
      {
        title: 'Learner Assessment Record Template',
        description: 'Template for recording assessment decisions and feedback',
        fileName: 'assessment-record-template.docx',
        fileUrl: '/uploads/materials/assessment-record-template.docx',
        fileType: 'template' as const,
        fileSize: 61440,
        category: 'template' as const,
      },
      {
        title: 'Quality Assurance Standards Guide',
        description: 'Guide to QA standards and standardisation procedures',
        fileName: 'qa-standards-guide.pdf',
        fileUrl: '/uploads/materials/qa-standards-guide.pdf',
        fileType: 'pdf' as const,
        fileSize: 1048576,
        category: 'guidance' as const,
      },
    ];

    for (const mat of materialsData) {
      await LearningMaterial.create({
        ...mat,
        qualificationId: qualification._id,
        uploadedBy: assessorUser._id,
        isFolder: false,
        folderId: null,
      });
      console.log(`  Created material: ${mat.title} (${mat.category})`);
    }
  } else {
    console.log('  Learning materials already exist, skipping...');
  }

  // ─── Done ─────────────────────────────────────────────────────────────────────
  console.log('\n--- Seed complete! ---');
  console.log('Summary:');
  console.log(`  Centre: ${centre.name}`);
  console.log(`  Qualification: ${qualification.title} (slug: ${qualification.slug})`);
  console.log(`  Units: ${unitsData.length}`);
  console.log(`  Users: ${usersData.length}`);
  console.log(`  Enrolments: 4 (Jane, Emma, Vidit, Intern)`);
  console.log(`  Assessments: 7 (3 for Jane, 4 for Emma)`);
  console.log(`  Work Hours: 8 entries (3 for Jane, 5 for Emma)`);
  console.log(`  Evidence: 6 files (3 for Jane, 3 for Emma)`);
  console.log(`  Course Documents: 5 files + 1 folder`);
  console.log(`  Personal Documents: 4 files (2 for Jane, 2 for Emma)`);
  console.log(`  Learning Materials: 6 items across 5 categories`);
  console.log(`\n  Login credentials:`);
  console.log(`    --- Test users ---`);
  console.log(`    Student 1: student@test.com / Password123! (Jane Smith)`);
  console.log(`    Student 2: student2@test.com / Password123! (Emma Thompson)`);
  console.log(`    IQA: iqa@test.com / Password123!`);
  console.log(`    --- Real users ---`);
  console.log(`    Assessor: jyothi@learnerseducation.com / password123`);
  console.log(`    Student: bhatnagar007vidit@gmail.com / password`);
  console.log(`    Student: intern@learnerseducation.com / password`);
  console.log(`    --- Admin ---`);
  console.log(`    Admin: admin@learnerseducation.com / passwordadmin`);
  console.log(`\n  Assessor dashboard URL: /c/${qualification.slug}`);

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB. Done.');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed script failed:', error);
  mongoose.disconnect();
  process.exit(1);
});
