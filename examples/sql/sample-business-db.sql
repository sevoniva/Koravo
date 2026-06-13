create table business_request (
  id varchar(64) primary key,
  applicant varchar(128) not null,
  department varchar(128) not null,
  subject varchar(256) not null,
  description varchar(1024),
  status varchar(64) not null,
  created_at timestamp not null
);

create table approval_record (
  id varchar(64) primary key,
  request_id varchar(64) not null,
  approver varchar(128) not null,
  decision varchar(64) not null,
  comment varchar(1024),
  created_at timestamp not null
);
