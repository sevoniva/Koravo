create table leave_request (
  id varchar(64) primary key,
  applicant varchar(128) not null,
  days int not null,
  reason varchar(1024),
  status varchar(64) not null,
  created_at timestamp not null
);

create table purchase_order (
  id varchar(64) primary key,
  requester varchar(128) not null,
  amount numeric(18, 2) not null,
  vendor varchar(256) not null,
  status varchar(64) not null,
  created_at timestamp not null
);
